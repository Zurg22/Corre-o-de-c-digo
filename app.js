const C=window.CONFIG,A=window.ASSETS,stage=document.getElementById('stage');
const st={uf:'',regiao:'',grupo:'',planta:''};let openF=null;
const img=k=>A[k]||k, esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* Menus: usam os valores REAIS do banco (/api/filtros); se a API falhar, usam as listas do config.js */
const FILT=[{k:'uf',n:'UF',x:597,o:()=>DB.filtros.uf.length?DB.filtros.uf:C.ufs},
 {k:'regiao',n:'REGIÃO',x:853,o:()=>DB.filtros.regiao.length?DB.filtros.regiao:C.regioes,w:1},
 {k:'grupo',n:'GRUPO',x:1107,o:()=>DB.filtros.grupo.length?DB.filtros.grupo:C.grupos.map(g=>g.nome)},{k:'planta',n:'PLANTA',x:1363,o:()=>C.plantas}];
function fit(){stage.style.transform=`translate(-50%,-50%) scale(${Math.min(innerWidth/1600,innerHeight/824)})`}
addEventListener('resize',fit);

/* Formatação dos números vindos da contagem filtrada (DB.cont) */
const fmt=n=>n==null?'—':Number(n).toLocaleString('pt-BR');
const cntTxt=nome=>DB.erro?'!':(DB.carregando||!DB.cont?'…':fmt(qtdGrupo(nome)));
const badge=nome=>`<i style="position:absolute;top:6px;right:10px;font:700 18px/1 sans-serif;font-style:normal;background:rgba(0,0,0,.65);color:#fff;padding:4px 9px;border-radius:12px">${cntTxt(nome)}</i>`;

function pbiUrl(base){
  const parts=FILT.map(f=>{const m=C.filtroPowerBI&&C.filtroPowerBI[f.k];
    if(!st[f.k]||!m||!m.tabela||!m.coluna)return null;
    const nm=s=>s.replace(/ /g,'_x0020_');
    return `${nm(m.tabela)}/${nm(m.coluna)} eq '${st[f.k].replace(/'/g,"''")}'`}).filter(Boolean);
  if(!parts.length)return base;
  return base+(base.includes('?')?'&':'?')+'filter='+encodeURI(parts.join(' and '));
}
function shell(label,inner,opts={}){
  const filters=FILT.map(f=>`<button class="a f ${st[f.k]?'on':''}" style="left:${f.x}px" data-f="${f.k}">${st[f.k]?esc(st[f.k].length>14?st[f.k].slice(0,13)+'…':st[f.k]):f.n}</button>`).join('');
  let menu='';
  if(openF){const f=FILT.find(x=>x.k===openF),o=f.o();
    menu=`<div class="a menu ${f.w?'wide':''}" style="left:${f.x-(f.w?106:0)}px"><button data-v="" class="${st[f.k]?'':'s'}">— Todos —</button>`+
      (o.length?o.map(v=>`<button data-v="${esc(v)}" class="${st[f.k]===v?'s':''}">${esc(v)}</button>`).join(''):'<button disabled>Defina em config.js</button>')+'</div>'}
  return `<img class="a chev" src="${img('chevron')}"><div class="a crumb"><b>Painel Clientes</b><span>[ ${esc(label)} ]</span></div>
  <div class="a bar"></div><div class="a panel"><img class="a mascot" src="${img('mascote')}"></div>
  <h1 class="a">${esc(C.titulo)}</h1>${opts.nosub?'':`<div class="a sub">${esc(C.subtitulo)}</div>`}${filters}${inner}${menu}`}

function home(){
  const X=[38,430,822,1214],Y=[260,408,554];
  return shell('página principal',kpis()+C.grupos.map((g,i)=>`<button class="a tile ${nk(st.grupo)===nk(g.nome)?'sel':''}" style="left:${X[i%4]}px;top:${Y[Math.floor(i/4)]}px" data-g="${g.id}"><img src="${img(g.icone)}"><span>${esc(g.nome)}</span>${badge(g.nome)}</button>`).join(''))}
function group(g){
  const emp=g.empresas.length?`<div class="a row">${g.empresas.map((e,i)=>`<div class="emp"><img src="${img(e.logo)}" alt="${esc(e.nome)}" onerror="this.style.visibility='hidden'">
    <button class="b" title="Mostrar total" data-e="${i}" data-t="planta">PLANTA</button>
    <button class="b" title="Mostrar total de acordo com SIGITM" data-e="${i}" data-t="reparo">REPARO</button></div>`).join('')}</div>`
    :`<div class="a hint">Nenhuma empresa cadastrada neste grupo ainda. Adicione em <code>config.js</code>.</div>`;
  return shell('página secundária',`<button class="a tile sel" style="left:38px;top:260px" data-home="1"><img src="${img(g.icone)}"><span>${esc(g.nome)}</span>${badge(g.nome)}</button>${emp}`)}
function dash(g,e,t){
  const url=(e.pbi||{})[t];
  const body=url?`<iframe src="${esc(pbiUrl(url))}" allowfullscreen title="${esc(e.nome)} - ${t}"></iframe>`
   :`<div class="ph"><h2>Dashboard ainda não conectado</h2><p>Cole o link do Power BI em <code>config.js</code> → grupo <b>${esc(g.nome)}</b> → empresa <b>${esc(e.nome)}</b> → <code>pbi.${t}</code>.</p></div>`;
  const cap=t==='planta'?'Total da planta':'Total de acordo com SIGITM';
  return shell(`${g.nome} › ${e.nome} › ${t.toUpperCase()}`,`<div class="a tb"><button class="b back" data-back="${g.id}">← Voltar</button><img src="${img(e.logo)}" onerror="this.style.visibility='hidden'">
    <button class="b ${t==='planta'?'on':''}" data-t2="planta">PLANTA</button><button class="b ${t==='reparo'?'on':''}" data-t2="reparo">REPARO</button>
    <span class="cap">${cap}</span><button class="b fs" data-fs="1">⛶ Tela cheia</button></div><div class="a dash" id="dash">${body}</div>`,{nosub:1})}

function route(){
  const p=location.hash.replace(/^#\/?/,'').split('/').filter(Boolean);
  const g=C.grupos.find(x=>x.id===p[1]);
  if(p[0]==='g'&&g){const e=g.empresas.findIndex(x=>x.nome===decodeURIComponent(p[2]||''));
    stage.innerHTML=(e>=0&&['planta','reparo'].includes(p[3]))?dash(g,g.empresas[e],p[3]):group(g)}
  else stage.innerHTML=home();
}
const go=h=>{openF=null;if(location.hash===h)route();else location.hash=h};
stage.addEventListener('click',ev=>{
  const t=ev.target.closest('button');if(!t){if(openF){openF=null;route()}return}
  const d=t.dataset,p=location.hash.replace(/^#\/?/,'').split('/');
  if(d.f){openF=openF===d.f?null:d.f;return route()}
  /* Escolheu um valor no menu: refaz a contagem no banco com TODOS os filtros ativos juntos */
  if(d.v!==undefined&&openF){const k=openF;st[k]=d.v;openF=null;if(k!=='planta')carregarContagem(st);return route()}
  /* Clicou num card de grupo: vira o filtro de grupo (nome exatamente como no banco) */
  if(d.g){const g=C.grupos.find(x=>x.id===d.g);st.grupo=nomeGrupoDB(g.nome);carregarContagem(st);return go('#/g/'+g.id)}
  if(d.home)return go('#/');
  if(d.back)return go('#/g/'+d.back);
  if(d.e!==undefined)return go(`#/g/${p[1]}/${encodeURIComponent(C.grupos.find(x=>x.id===p[1]).empresas[d.e].nome)}/${d.t}`);
  if(d.t2)return go(`#/g/${p[1]}/${p[2]}/${d.t2}`);
  if(d.fs){const el=document.getElementById('dash');(el.requestFullscreen||el.webkitRequestFullscreen).call(el)}
});
addEventListener('hashchange',route);fit();route();carregarGrupos();

/* ---------- Cards de indicadores (página principal) ----------
   TODOS leem DB.cont, que vem de /api/contagem já com UF + Região + Grupo aplicados.
   Sem filtro = números gerais; com filtro = números só dos registros filtrados. */
function kpis(){
  const c=DB.cont;
  const v=x=>DB.erro?'<span title="'+esc(DB.erro)+'">API offline</span>':(DB.carregando||!c?'…':fmt(x));
  const sel=st.grupo;
  return `<div class="a kpi" style="left:38px"><span>Total de registros</span><b>${v(c&&c.total)}</b></div>
  <div class="a kpi" style="left:430px"><span>Total de grupos</span><b>${v(c&&c.grupos)}</b></div>
  <div class="a kpi" style="left:822px"><span>${sel?esc(sel):'Selecione um grupo'}</span><b>${sel?v(c&&c.total):'—'}</b></div>
  <div class="a kpi" style="left:1214px"><span>Estados / Regiões</span><b>${v(c&&c.ufs)}${(!DB.erro&&!DB.carregando&&c)?' / '+fmt(c.regioes):''}</b></div>`}
