/* ============================================================
   api.js — comunicação com a API (Node + PostgreSQL)
   Endpoints usados:
     GET /api/filtros                       -> valores reais de UF, Região e Grupo (menus)
     GET /api/contagem?uf=&regiao=&grupo=   -> total + contagem por grupo JÁ FILTRADOS
   ============================================================ */
const API = (window.CONFIG && window.CONFIG.api) || 'http://localhost:3000';

// Estado compartilhado com o app.js
//  filtros : opções dos menus (vindas do banco)
//  cont    : resultado da última contagem filtrada (fonte única de todos os indicadores)
const DB = {
  filtros: { uf: [], regiao: [], grupo: [] },
  cont: null,
  carregando: false,
  erro: ''
};

// Normaliza texto para comparar nomes (sem acento, sem espaços nas pontas, maiúsculo)
const nk = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

async function getJson(caminho) {
  const r = await fetch(API + caminho);
  let corpo = null;
  try { corpo = await r.json(); } catch (_) {}
  if (!r.ok) throw new Error((corpo && corpo.erro) || ('HTTP ' + r.status + ' em ' + caminho));
  return corpo;
}

// Monta ?uf=..&regiao=..&grupo=.. só com os filtros preenchidos
function queryFiltros(f) {
  const p = new URLSearchParams();
  ['uf', 'regiao', 'grupo'].forEach(k => { if (f && f[k]) p.set(k, f[k]); });
  const s = p.toString();
  return s ? '?' + s : '';
}

// Quantidade de um grupo considerando os filtros ativos (UF + Região)
function qtdGrupo(nome) {
  if (!DB.cont) return null;
  const v = DB.cont.porGrupo[nk(nome)];
  return v === undefined ? 0 : v;
}

// Nome do grupo exatamente como está no banco (para o filtro bater)
function nomeGrupoDB(nome) {
  const achou = DB.filtros.grupo.find(g => nk(g) === nk(nome));
  return achou || nome;
}

async function carregarFiltros() {
  try {
    const d = await getJson('/api/filtros');
    DB.filtros = { uf: d.uf || [], regiao: d.regiao || [], grupo: d.grupo || [] };
  } catch (e) {
    console.error('Falha ao carregar filtros (usando listas do config.js):', e);
  }
  route();
}

// Busca no banco a contagem de acordo com os filtros ativos.
// Todos os indicadores do painel leem DB.cont — não existe mais outro caminho de contagem.
let _seq = 0;
async function carregarContagem(f) {
  const meu = ++_seq;           // evita que uma resposta antiga sobrescreva uma mais nova
  DB.carregando = true;
  route();
  try {
    const d = await getJson('/api/contagem' + queryFiltros(f || st));
    if (meu !== _seq) return;
    const porGrupo = {};
    (d.porGrupo || []).forEach(x => { porGrupo[nk(x.grupo)] = Number(x.quantidade); });
    DB.cont = { total: Number(d.total), grupos: Number(d.grupos), ufs: Number(d.ufs), regioes: Number(d.regioes), porGrupo };
    DB.erro = '';
  } catch (e) {
    if (meu !== _seq) return;
    DB.cont = null;
    DB.erro = e.message;
    console.error('Falha ao carregar contagem:', e);
  }
  DB.carregando = false;
  route();
}

// Chamada inicial (o index.html confere se esta função existe)
async function carregarGrupos() {
  await Promise.all([carregarFiltros(), carregarContagem(st)]);
}
