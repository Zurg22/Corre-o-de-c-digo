/* ============================================================
   rotas-filtros.js — endpoints de filtro (Express + PostgreSQL)

   GET /api/filtros
        -> { uf: [...], regiao: [...], grupo: [...] }  valores reais do banco

   GET /api/contagem?uf=&regiao=&grupo=
        -> {
             total:    registros que atendem a TODOS os filtros ao mesmo tempo,
             grupos:   quantos grupos distintos existem nesse conjunto filtrado,
             ufs:      quantas UFs distintas existem nesse conjunto filtrado,
             regioes:  quantas regiões distintas existem nesse conjunto filtrado,
             porGrupo: [{ grupo, quantidade }]  contagem de CADA grupo considerando
                       UF + Região (o filtro de grupo não zera os outros cards)
           }
        Filtro vazio/ausente = não filtra.

   Ligado no server.js com:
       app.use('/api', require('./rotas-filtros')(pool));
   ============================================================ */
const express = require('express');

const TABELA = 'dados_painel_b2b';

// Nomes possíveis de cada coluna (o primeiro que existir na tabela é usado).
// Maiúsculas/minúsculas e acentos não importam.
const COLUNAS = {
  uf:     ['uf', 'estado', 'sigla_uf'],
  regiao: ['regiao', 'regional', 'regiao_b2b'],
  grupo:  ['grupo']
};

const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const q = s => '"' + String(s).replace(/"/g, '""') + '"';   // aspas de identificador do PostgreSQL

module.exports = function (pool) {
  const router = express.Router();
  let cache = null;

  // Descobre o nome real da tabela e das colunas (uma vez só)
  async function resolver() {
    if (cache) return cache;
    const r = await pool.query(
      `SELECT table_schema, table_name, column_name
         FROM information_schema.columns
        WHERE lower(table_name) = lower($1)
          AND table_schema NOT IN ('pg_catalog','information_schema')`, [TABELA]);
    if (!r.rows.length)
      throw new Error(`Tabela "${TABELA}" não encontrada. Ajuste a constante TABELA em rotas-filtros.js.`);
    const { table_schema, table_name } = r.rows[0];
    const existentes = r.rows.map(x => x.column_name);
    const cols = {};
    for (const [chave, candidatas] of Object.entries(COLUNAS)) {
      let achou = null;
      for (const nome of candidatas) {
        achou = existentes.find(c => norm(c) === norm(nome));
        if (achou) break;
      }
      if (!achou)
        throw new Error(`Coluna do filtro "${chave}" não encontrada (tentei: ${candidatas.join(', ')}). ` +
                        `Colunas da tabela: ${existentes.join(', ')}. Ajuste COLUNAS em rotas-filtros.js.`);
      cols[chave] = achou;
    }
    cache = { tabela: `${q(table_schema)}.${q(table_name)}`, cols };
    return cache;
  }

  // Valor "limpo" de uma coluna (sem espaços nas pontas; vazio vira NULL)
  const val = (cols, chave) => `NULLIF(TRIM(${q(cols[chave])}::text), '')`;

  // Monta o WHERE com os filtros pedidos (todos combinados com AND)
  function montarWhere(cols, req, chaves) {
    const where = [], vals = [];
    for (const chave of chaves) {
      const v = req.query[chave];
      if (typeof v === 'string' && v.trim() !== '') {
        vals.push(v.trim());
        where.push(`${val(cols, chave)} = $${vals.length}`);
      }
    }
    return { where, vals };
  }
  const sqlWhere = w => (w.length ? ' WHERE ' + w.join(' AND ') : '');

  router.get('/filtros', async (req, res) => {
    try {
      const { tabela, cols } = await resolver();
      const out = {};
      for (const chave of Object.keys(cols)) {
        const r = await pool.query(
          `SELECT DISTINCT ${val(cols, chave)} AS v FROM ${tabela}
            WHERE ${val(cols, chave)} IS NOT NULL ORDER BY 1`);
        out[chave] = r.rows.map(x => x.v);
      }
      res.json(out);
    } catch (e) { console.error(e); res.status(500).json({ erro: e.message }); }
  });

  router.get('/contagem', async (req, res) => {
    try {
      const { tabela, cols } = await resolver();

      // 1) Todos os indicadores: UF + Região + Grupo aplicados juntos
      const todos = montarWhere(cols, req, ['uf', 'regiao', 'grupo']);
      const sqlTotais =
        `SELECT COUNT(*)::int AS total,
                COUNT(DISTINCT ${val(cols, 'grupo')})::int  AS grupos,
                COUNT(DISTINCT ${val(cols, 'uf')})::int     AS ufs,
                COUNT(DISTINCT ${val(cols, 'regiao')})::int AS regioes
           FROM ${tabela}` + sqlWhere(todos.where);

      // 2) Cards de grupos: UF + Região aplicados (o próprio filtro de grupo não entra,
      //    para os demais cards continuarem mostrando seus números)
      const base = montarWhere(cols, req, ['uf', 'regiao']);
      const w2 = [`${val(cols, 'grupo')} IS NOT NULL`, ...base.where];
      const sqlGrupos =
        `SELECT ${val(cols, 'grupo')} AS grupo, COUNT(*)::int AS quantidade
           FROM ${tabela}` + sqlWhere(w2) + ` GROUP BY 1 ORDER BY 2 DESC`;

      const [rt, rg] = await Promise.all([
        pool.query(sqlTotais, todos.vals),
        pool.query(sqlGrupos, base.vals)
      ]);

      res.json({ ...rt.rows[0], porGrupo: rg.rows });
    } catch (e) { console.error(e); res.status(500).json({ erro: e.message }); }
  });

  return router;
};
