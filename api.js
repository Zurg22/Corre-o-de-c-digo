/* ============================================================
   api.js — comunicação com a API (Node + PostgreSQL)
     GET /api/filtros                        -> opções dos menus (UF, Cliente, Grupo)
     GET /api/contagem?uf=&cliente=&grupo=   -> indicadores já filtrados
   ============================================================ */
const API = (window.CONFIG && window.CONFIG.api) || 'http://localhost:3000';
const FILTROS_DB = ['uf', 'cliente', 'grupo'];      // filtros que existem no banco

// Estado compartilhado com o app.js
const DB = {
  filtros: { uf: [], cliente: [], grupo: [] },      // opções dos menus
  cont: null,                                       // última contagem (fonte única dos indicadores)
  carregando: false,
  erro: '',
};

/* ---------- Helpers ---------- */
// Compara nomes sem acento, sem espaços nas pontas, em maiúsculo
const nk = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

async function getJson(caminho) {
  const r = await fetch(API + caminho);
  const corpo = await r.json().catch(() => null);
  if (!r.ok) throw new Error((corpo && corpo.erro) || `HTTP ${r.status} em ${caminho}`);
  return corpo;
}

// ?uf=..&cliente=..&grupo=.. só com os filtros preenchidos
function queryFiltros(f) {
  const p = new URLSearchParams();
  FILTROS_DB.forEach(k => f[k] && p.set(k, f[k]));
  const s = p.toString();
  return s ? '?' + s : '';
}

/* ---------- Leitura do estado ---------- */
// Quantidade de um grupo considerando UF + Cliente ativos
function qtdGrupo(nome) {
  if (!DB.cont) return null;
  return DB.cont.porGrupo[nk(nome)] ?? 0;
}

// Nome do grupo exatamente como está no banco (para o filtro bater)
const nomeGrupoDB = nome => DB.filtros.grupo.find(g => nk(g) === nk(nome)) || nome;

/* ---------- Chamadas ---------- */
async function carregarFiltros() {
  try {
    const d = await getJson('/api/filtros');
    FILTROS_DB.forEach(k => { DB.filtros[k] = d[k] || []; });
  } catch (e) {
    console.error('Falha ao carregar filtros (usando listas do config.js):', e);
  }
  route();
}

let _seq = 0;                                       // evita resposta antiga sobrescrever a nova
async function carregarContagem(f = st) {
  const meu = ++_seq;
  DB.carregando = true;
  route();
  try {
    const d = await getJson('/api/contagem' + queryFiltros(f));
    if (meu !== _seq) return;
    const porGrupo = {};
    (d.porGrupo || []).forEach(x => { porGrupo[nk(x.grupo)] = Number(x.quantidade); });
    DB.cont = { total: +d.total, grupos: +d.grupos, ufs: +d.ufs, clientes: +d.clientes, porGrupo };
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

// Chamada inicial
const carregarGrupos = () => Promise.all([carregarFiltros(), carregarContagem(st)]);
