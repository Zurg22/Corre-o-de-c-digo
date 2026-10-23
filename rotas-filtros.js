/* ============================================================
   rotas-filtros.js — endpoints de filtro (Express + PostgreSQL)

   GET /api/filtros
     -> { uf: [...], cliente: [...], grupo: [...] }   valores reais do banco

   GET /api/contagem?uf=&cliente=&grupo=
     -> { total, grupos, ufs, clientes, porGrupo: [{ grupo, quantidade }] }
        total/grupos/ufs/clientes: usam os 3 filtros juntos
        porGrupo: usa só UF + Cliente (o filtro de grupo não zera os outros cards)
     Filtro vazio/ausente = não filtra.

   Uso no server.js:
     app.use('/api', require('./rotas-filtros')(pool));
   ============================================================ */
const express = require('express');

/* ---------- CONFIGURAÇÃO (só mexer aqui) ---------- */
const TABELA = 'dados_painel_b2b';

// filtro -> nomes possíveis da coluna no banco (o primeiro que existir é usado)
const COLUNAS = {
  uf:      ['uf', 'estado', 'sigla_uf'],
  cliente: ['cliente', 'nome_cliente', 'razao_social'],
  grupo:   ['grupo'],
};

/* ---------- Helpers ---------- */
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const aspas = s => '"' + String(s).replace(/"/g, '""') + '"';          // identificador do PostgreSQL

module.exports = function (pool) {
  const router = express.Router();
  let cache = null;

  // Descobre o nome real da tabela e das colunas (só na primeira chamada)
  async function resolver() {
    if (cache) return cache;

    const { rows } = await pool.query(
      `SELECT table_schema, table_name, column_name
         FROM information_schema.columns
        WHERE lower(table_name) = lower($1)
          AND table_schema NOT IN ('pg_catalog', 'information_schema')`, [TABELA]);
    if (!rows.length) throw new Error(`Tabela "${TABELA}" não encontrada (ajuste TABELA).`);

    const existentes = rows.map(r => r.column_name);
    const cols = {};
    for (const [chave, candidatas] of Object.entries(COLUNAS)) {
      cols[chave] = existentes.find(c => candidatas.some(n => norm(c) === norm(n)));
      if (!cols[chave])
        throw new Error(`Coluna do filtro "${chave}" não encontrada (tentei: ${candidatas.join(', ')}). ` +
                        `Colunas da tabela: ${existentes.join(', ')}.`);
    }
    const { table_schema, table_name } = rows[0];
    return (cache = { tabela: `${aspas(table_schema)}.${aspas(table_name)}`, cols });
  }

  // Valor "limpo" da coluna: sem espaços nas pontas; vazio vira NULL
  const val = (cols, chave) => `NULLIF(TRIM(${aspas(cols[chave])}::text), '')`;

  // WHERE com os filtros pedidos (combinados com AND) + valores para o $1, $2...
  function filtrar(cols, query, chaves, extras = []) {
    const where = [...extras], vals = [];
    for (const chave of chaves) {
      const v = query[chave];
      if (typeof v === 'string' && v.trim()) {
        vals.push(v.trim());
        where.push(`${val(cols, chave)} = $${vals.length}`);
      }
    }
    return { sql: where.length ? ' WHERE ' + where.join(' AND ') : '', vals };
  }

  // Envolve um handler para tratar erro em um lugar só
  const rota = fn => async (req, res) => {
    try { res.json(await fn(req)); }
    catch (e) { console.error(e); res.status(500).json({ erro: e.message }); }
  };

  /* ---------- Rotas ---------- */
  router.get('/filtros', rota(async () => {
    const { tabela, cols } = await resolver();
    const chaves = Object.keys(cols);
    const listas = await Promise.all(chaves.map(c =>
      pool.query(`SELECT DISTINCT ${val(cols, c)} AS v FROM ${tabela}
                   WHERE ${val(cols, c)} IS NOT NULL ORDER BY 1`)));
    return Object.fromEntries(chaves.map((c, i) => [c, listas[i].rows.map(r => r.v)]));
  }));

  router.get('/contagem', rota(async req => {
    const { tabela, cols } = await resolver();
    const todos = filtrar(cols, req.query, Object.keys(cols));                       // UF + Cliente + Grupo
    const base  = filtrar(cols, req.query, ['uf', 'cliente'],
                          [`${val(cols, 'grupo')} IS NOT NULL`]);                    // UF + Cliente

    const [totais, grupos] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(DISTINCT ${val(cols, 'grupo')})::int   AS grupos,
                COUNT(DISTINCT ${val(cols, 'uf')})::int      AS ufs,
                COUNT(DISTINCT ${val(cols, 'cliente')})::int AS clientes
           FROM ${tabela}${todos.sql}`, todos.vals),
      pool.query(
        `SELECT ${val(cols, 'grupo')} AS grupo, COUNT(*)::int AS quantidade
           FROM ${tabela}${base.sql} GROUP BY 1 ORDER BY 2 DESC`, base.vals),
    ]);

    return { ...totais.rows[0], porGrupo: grupos.rows };
  }));

  return router;
};
