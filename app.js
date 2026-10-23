/* ============================================================
   app.js — telas do painel (home, grupo, dashboard) e eventos
   Depende de: config.js (CONFIG, ASSETS) e api.js (DB, qtdGrupo, ...)
   Seções: 1 Estado · 2 Utilitários · 3 Filtros · 4 Componentes
           5 Telas · 6 Rotas · 7 Eventos · 8 Início
   ============================================================ */
const C = window.CONFIG, A = window.ASSETS;
const stage = document.getElementById('stage');

/* ---------- 1. Estado ---------- */
const st = { uf: '', cliente: '', grupo: '', planta: '' };   // filtros ativos
let openF = null;                                            // menu de filtro aberto

/* ---------- 2. Utilitários ---------- */
const img = k => A[k] || k;
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = s => String(s).replace(/[&<>"]/g, c => ESC[c]);
const fmt = n => n == null ? '—' : Number(n).toLocaleString('pt-BR');
const hashParts = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);

function fit() {
  stage.style.transform = `translate(-50%,-50%) scale(${Math.min(innerWidth / 1600, innerHeight / 824)})`;
}

const carregando = () => DB.carregando || !DB.cont;
const cntTxt = nome => DB.erro ? '!' : carregando() ? '…' : fmt(qtdGrupo(nome));
const kpiVal = x => DB.erro ? `<span title="${esc(DB.erro)}">API offline</span>` : carregando() ? '…' : fmt(x);

/* ---------- 3. Filtros ----------
   Menus usam os valores REAIS do banco (/api/filtros);
   se a API falhar, usam as listas do config.js. */
const opcoes = (k, reserva) => DB.filtros[k] && DB.filtros[k].length ? DB.filtros[k] : (reserva || []);

const FILT = [
  { k: 'uf',      n: 'UF',      x: 597,  o: () => opcoes('uf', C.ufs) },
  { k: 'cliente', n: 'CLIENTE', x: 853,  o: () => opcoes('cliente', C.clientes), wide: true },
  { k: 'grupo',   n: 'GRUPO',   x: 1107, o: () => opcoes('grupo', C.grupos.map(g => g.nome)) },
  { k: 'planta',  n: 'PLANTA',  x: 1363, o: () => C.plantas },   // só afeta o Power BI, não o banco
];

// URL do Power BI com os filtros ativos (mapeados em C.filtroPowerBI)
const pbiNome = s => s.replace(/ /g, '_x0020_');
function pbiUrl(base) {
  const partes = FILT.map(f => {
    const m = C.filtroPowerBI && C.filtroPowerBI[f.k];
    if (!st[f.k] || !m || !m.tabela || !m.coluna) return null;
    return `${pbiNome(m.tabela)}/${pbiNome(m.coluna)} eq '${st[f.k].replace(/'/g, "''")}'`;
  }).filter(Boolean);
  if (!partes.length) return base;
  return base + (base.includes('?') ? '&' : '?') + 'filter=' + encodeURI(partes.join(' and '));
}

/* ---------- 4. Componentes ---------- */
const BADGE_STYLE = 'position:absolute;top:6px;right:10px;font:700 18px/1 sans-serif;font-style:normal;' +
                    'background:rgba(0,0,0,.65);color:#fff;padding:4px 9px;border-radius:12px';
const badge = nome => `<i style="${BADGE_STYLE}">${cntTxt(nome)}</i>`;

const tile = (g, x, y, attr, sel) =>
  `<button class="a tile ${sel ? 'sel' : ''}" style="left:${x}px;top:${y}px" ${attr}>
     <img src="${img(g.icone)}"><span>${esc(g.nome)}</span>${badge(g.nome)}</button>`;

const kpi = (x, titulo, valor) =>
  `<div class="a kpi" style="left:${x}px"><span>${titulo}</span><b>${valor}</b></div>`;

// Cards de indicadores (home). Todos leem DB.cont, já filtrado por UF + Cliente + Grupo.
function kpis() {
  const c = DB.cont, sel = st.grupo;
  const ufsClientes = kpiVal(c && c.ufs) + (!DB.erro && !carregando() ? ' / ' + fmt(c.clientes) : '');
  return kpi(38,   'Total de registros', kpiVal(c && c.total)) +
         kpi(430,  'Total de grupos',     kpiVal(c && c.grupos)) +
         kpi(822,  sel ? esc(sel) : 'Selecione um grupo', sel ? kpiVal(c && c.total) : '—') +
         kpi(1214, 'Estados / Clientes',  ufsClientes);
}

function botoesFiltro() {
  return FILT.map(f => {
    const v = st[f.k];
    const texto = v ? esc(v.length > 14 ? v.slice(0, 13) + '…' : v) : f.n;
    return `<button class="a f ${v ? 'on' : ''}" style="left:${f.x}px" data-f="${f.k}">${texto}</button>`;
  }).join('');
}

function menuFiltro() {
  if (!openF) return '';
  const f = FILT.find(x => x.k === openF), lista = f.o();
  const item = (v, rotulo) => `<button data-v="${esc(v)}" class="${st[f.k] === v ? 's' : ''}">${esc(rotulo)}</button>`;
  const itens = lista.length ? lista.map(v => item(v, v)).join('') : '<button disabled>Defina em config.js</button>';
  return `<div class="a menu ${f.wide ? 'wide' : ''}" style="left:${f.x - (f.wide ? 106 : 0)}px">
    <button data-v="" class="${st[f.k] ? '' : 's'}">— Todos —</button>${itens}</div>`;
}

// Moldura comum a todas as telas
function shell(label, inner, { nosub = false } = {}) {
  return `<img class="a chev" src="${img('chevron')}">
    <div class="a crumb"><b>Painel Clientes</b><span>[ ${esc(label)} ]</span></div>
    <div class="a bar"></div><div class="a panel"><img class="a mascot" src="${img('mascote')}"></div>
    <h1 class="a">${esc(C.titulo)}</h1>${nosub ? '' : `<div class="a sub">${esc(C.subtitulo)}</div>`}
    ${botoesFiltro()}${inner}${menuFiltro()}`;
}

/* ---------- 5. Telas ---------- */
function home() {
  const X = [38, 430, 822, 1214], Y = [260, 408, 554];
  const cards = C.grupos.map((g, i) =>
    tile(g, X[i % 4], Y[Math.floor(i / 4)], `data-g="${g.id}"`, nk(st.grupo) === nk(g.nome))).join('');
  return shell('página principal', kpis() + cards);
}

function group(g) {
  const empresas = g.empresas.map((e, i) => `
    <div class="emp"><img src="${img(e.logo)}" alt="${esc(e.nome)}" onerror="this.style.visibility='hidden'">
      <button class="b" title="Mostrar total" data-e="${i}" data-t="planta">PLANTA</button>
      <button class="b" title="Mostrar total de acordo com SIGITM" data-e="${i}" data-t="reparo">REPARO</button></div>`).join('');
  const corpo = g.empresas.length
    ? `<div class="a row">${empresas}</div>`
    : '<div class="a hint">Nenhuma empresa cadastrada neste grupo ainda. Adicione em <code>config.js</code>.</div>';
  return shell('página secundária', tile(g, 38, 260, 'data-home="1"', true) + corpo);
}

function dash(g, e, t) {
  const url = (e.pbi || {})[t];
  const corpo = url
    ? `<iframe src="${esc(pbiUrl(url))}" allowfullscreen title="${esc(e.nome)} - ${t}"></iframe>`
    : `<div class="ph"><h2>Dashboard ainda não conectado</h2><p>Cole o link do Power BI em <code>config.js</code> →
       grupo <b>${esc(g.nome)}</b> → empresa <b>${esc(e.nome)}</b> → <code>pbi.${t}</code>.</p></div>`;
  const tab = tipo => `<button class="b ${t === tipo ? 'on' : ''}" data-t2="${tipo}">${tipo.toUpperCase()}</button>`;
  const legenda = t === 'planta' ? 'Total da planta' : 'Total de acordo com SIGITM';

  return shell(`${g.nome} › ${e.nome} › ${t.toUpperCase()}`, `
    <div class="a tb"><button class="b back" data-back="${g.id}">← Voltar</button>
      <img src="${img(e.logo)}" onerror="this.style.visibility='hidden'">
      ${tab('planta')}${tab('reparo')}
      <span class="cap">${legenda}</span><button class="b fs" data-fs="1">⛶ Tela cheia</button></div>
    <div class="a dash" id="dash">${corpo}</div>`, { nosub: true });
}

/* ---------- 6. Rotas ----------
   #/                      home
   #/g/<grupo>             empresas do grupo
   #/g/<grupo>/<empresa>/<planta|reparo>   dashboard */
function route() {
  const [pagina, idGrupo, empresa, tipo] = hashParts();
  const g = C.grupos.find(x => x.id === idGrupo);
  if (pagina !== 'g' || !g) { stage.innerHTML = home(); return; }

  const e = g.empresas.find(x => x.nome === decodeURIComponent(empresa || ''));
  stage.innerHTML = e && ['planta', 'reparo'].includes(tipo) ? dash(g, e, tipo) : group(g);
}

const go = h => {
  openF = null;
  if (location.hash === h) route(); else location.hash = h;
};

/* ---------- 7. Eventos (um único listener) ---------- */
stage.addEventListener('click', ev => {
  const t = ev.target.closest('button');
  if (!t) { if (openF) { openF = null; route(); } return; }

  const d = t.dataset, p = hashParts();

  // Abrir/fechar menu de filtro
  if (d.f) { openF = openF === d.f ? null : d.f; return route(); }

  // Escolheu valor no menu: recalcula no banco com TODOS os filtros juntos
  if (d.v !== undefined && openF) {
    const k = openF;
    st[k] = d.v; openF = null;
    if (k !== 'planta') carregarContagem(st);
    return route();
  }

  // Card de grupo: vira o filtro de grupo (nome exatamente como no banco)
  if (d.g) {
    const g = C.grupos.find(x => x.id === d.g);
    st.grupo = nomeGrupoDB(g.nome);
    carregarContagem(st);
    return go('#/g/' + g.id);
  }

  if (d.home) return go('#/');
  if (d.back) return go('#/g/' + d.back);
  if (d.e !== undefined) {
    const emp = C.grupos.find(x => x.id === p[1]).empresas[d.e];
    return go(`#/g/${p[1]}/${encodeURIComponent(emp.nome)}/${d.t}`);
  }
  if (d.t2) return go(`#/g/${p[1]}/${p[2]}/${d.t2}`);
  if (d.fs) {
    const el = document.getElementById('dash');
    (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  }
});

/* ---------- 8. Início ---------- */
addEventListener('hashchange', route);
addEventListener('resize', fit);
fit();
route();
carregarGrupos();
