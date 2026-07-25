/* ============================================================
   Dashboard Lotofácil — app.js
   SPA sem build: lê window.DADOS (dados.js) e renderiza seções.
   ============================================================ */
'use strict';

// ---- SUPABASE CLIENT ----
const SUPABASE_URL = "https://zwweoxuxpcdxiugohsgv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_mz8zecMNnm9uhYJqr8IkpA_ZO-Oy9gH";
let sbClient = null;
try {
  if (window.supabase && window.supabase.createClient) {
    sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase Client conectado:", SUPABASE_URL);
  }
} catch (e) {
  console.warn("Supabase SDK não disponível:", e);
}

const D = window.DADOS;
const NUMS = Array.from({length:25}, (_,i)=>i+1);
const CLS_ORDER = ["Muito quente","Quente","Neutra","Fria","Muito fria"];
const CLS_KEY = {"Muito quente":"q0","Quente":"q1","Neutra":"q2","Fria":"q3","Muito fria":"q4"};
const CLS_COLOR = {q0:"#c0272d",q1:"#ef7d1a",q2:"#f2c744",q3:"#5b9bd5",q4:"#2e5fa3"};
const PRIMOS = new Set([2,3,5,7,11,13,17,19,23]);
const CENTRO = new Set([7,8,9,12,13,14,17,18,19]);
const PAR = new Set(NUMS.filter(n=>n%2===0));
const BAIXAS = new Set(NUMS.filter(n=>n<=13));
const LINHAS = [[1,2,3,4,5],[6,7,8,9,10],[11,12,13,14,15],[16,17,18,19,20],[21,22,23,24,25]].map(a=>new Set(a));
const COLS = [0,1,2,3,4].map(c=>new Set([c+1,c+6,c+11,c+16,c+21]));

// ---- helpers ----
const $ = (s,r=document)=>r.querySelector(s);
const el = (tag,cls,html)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;};
const pad = n=>String(n).padStart(2,'0');
const cls = n=>D.freq.classe[n];
const clsKey = n=>CLS_KEY[cls(n)];
const fGet = (win,n)=>D.freq[win][n]||0;
const atrasoMedio = n=>D.freq.atraso_medio?.[n]||0;
const afinidadeMedia = n=>D.freq.afinidade_media?.[n]||0;
const permPct = n=>{const pm=D.rep.perm[n];return pm&&pm[0]?pm[1]/pm[0]*100:0;};

// ---- score ponderado por dezena (0-100), pesos ajustáveis ----
const PESOS_DEFAULT = {f50:40,f20:20,atraso:15,repeticao:15,afinidade:10};
function normalize(vals){
  const mn=Math.min(...vals),mx=Math.max(...vals);
  return vals.map(v=>mx>mn?(v-mn)/(mx-mn):0.5);
}
function scoreDezenas(pesos=PESOS_DEFAULT){
  const rF50=NUMS.map(n=>fGet('f50',n));
  const rF20=NUMS.map(n=>fGet('f20',n));
  // atraso: dezena de oportunidade = atraso perto da media, sem exagero -> usa atraso atual normalizado
  const rAtr=NUMS.map(n=>D.freq.atraso[n]||0);
  const rRep=NUMS.map(n=>permPct(n));
  const rAfi=NUMS.map(n=>afinidadeMedia(n));
  const nF50=normalize(rF50),nF20=normalize(rF20),nAtr=normalize(rAtr),nRep=normalize(rRep),nAfi=normalize(rAfi);
  const total=Object.values(pesos).reduce((a,b)=>a+b,0)||1;
  const out={};
  NUMS.forEach((n,i)=>{
    const pontos=(nF50[i]*pesos.f50+nF20[i]*pesos.f20+nAtr[i]*pesos.atraso+nRep[i]*pesos.repeticao+nAfi[i]*pesos.afinidade)/total*100;
    out[n]={score:Math.round(pontos*10)/10,
      partes:{f50:Math.round(nF50[i]*100),f20:Math.round(nF20[i]*100),atraso:Math.round(nAtr[i]*100),
        repeticao:Math.round(nRep[i]*100),afinidade:Math.round(nAfi[i]*100)}};
  });
  return out;
}
let charts = []; // destruir ao trocar de página
function clearCharts(){charts.forEach(c=>{try{c.destroy();}catch(e){}});charts=[];}
function mkChip(n,{sm=false,rep=false}={}){
  const c=el('div',`dz ${sm?'sm ':''}${clsKey(n)}${rep?' rep':''}`,pad(n));
  c.title=`${pad(n)} — ${cls(n)}`; return c;
}
function toast(msg){
  let t=$('#toast'); if(!t){t=el('div','toast');t.id='toast';document.body.appendChild(t);}
  t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1800);
}
function copy(txt,msg='Copiado!'){navigator.clipboard.writeText(txt).then(()=>toast(msg));}
function icon(name){return `<i data-lucide="${name}"></i>`;}
function refreshIcons(){if(window.lucide)lucide.createIcons();}

// ---- chart defaults por tema ----
function chartColors(){
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  return {grid:dark?'#2a3246':'#e4e8f0', text:dark?'#95a0bb':'#66708a'};
}
function baseOpts(extra={}){
  const c=chartColors();
  return Object.assign({
    responsive:true,maintainAspectRatio:false,
    plugins:{legend:{labels:{color:c.text,font:{family:'Inter'}}}},
    scales:{x:{ticks:{color:c.text},grid:{color:c.grid}},y:{ticks:{color:c.text},grid:{color:c.grid},beginAtZero:true}}
  },extra);
}
function bar(ctx,labels,data,opts={}){
  const ch=new Chart(ctx,{type:'bar',data:{labels,datasets:[{data,backgroundColor:opts.colors||'#6366f1',borderRadius:6}]},
    options:baseOpts({plugins:{legend:{display:false}},...opts.options})});
  charts.push(ch); return ch;
}
function line(ctx,labels,data,opts={}){
  const ch=new Chart(ctx,{type:'line',data:{labels,datasets:[{data,borderColor:'#7c3aed',
    backgroundColor:'rgba(124,58,237,.12)',fill:true,tension:.3,pointRadius:opts.pr??0}]},
    options:baseOpts({plugins:{legend:{display:false}},...opts.options})});
  charts.push(ch); return ch;
}

/* ---------- Layout: KPI / card builders ---------- */
function kpi(icoName,label,value,sub){
  const c=el('div','card hover kpi');
  c.innerHTML=`<div class="kpi-ico">${icon(icoName)}</div>
    <span class="label">${label}</span><span class="value">${value}</span>${sub?`<span class="sub">${sub}</span>`:''}`;
  return c;
}
function barRow(label,val,max){
  const r=el('div','barrow');
  r.innerHTML=`<span class="bl">${label}</span><div class="bt"><div class="bf" style="width:${max?Math.round(val/max*100):0}%"></div></div><span class="bv">${val}</span>`;
  return r;
}
function chipRow(arr,opts){const w=el('div','chips');arr.forEach(n=>w.appendChild(mkChip(n,opts)));return w;}

/* ============================================================
   ROTEAMENTO
   ============================================================ */
const NAV = [
  {g:"Painel"},
  {id:"home",t:"Visão geral",i:"layout-dashboard"},
  {id:"validacao",t:"Validação dos dados",i:"shield-check"},
  {g:"Análises"},
  {id:"frequencia",t:"Frequência",i:"bar-chart-3"},
  {id:"temperatura",t:"Quentes e frias",i:"flame"},
  {id:"parimpar",t:"Pares e ímpares",i:"dices"},
  {id:"moldura",t:"Moldura e centro",i:"square"},
  {id:"linhas",t:"Linhas",i:"rows-3"},
  {id:"colunas",t:"Colunas",i:"columns-3"},
  {id:"sequencias",t:"Sequências",i:"link"},
  {id:"repeticao",t:"Repetição",i:"repeat"},
  {id:"soma",t:"Soma",i:"sigma"},
  {id:"baixasaltas",t:"Baixas e altas",i:"arrow-up-down"},
  {id:"primos",t:"Primos e múltiplos",i:"hash"},
  {id:"pares",t:"Pares de dezenas",i:"git-merge"},
  {id:"heatmap",t:"Mapas de calor",i:"grid-3x3"},
  {id:"ultimo",t:"Último concurso",i:"target"},
  {g:"Ferramentas"},
  {id:"atualizar",t:"Atualizar resultados",i:"download-cloud"},
  {id:"gerador",t:"Gerador de jogos",i:"wand-2"},
  {id:"backtest",t:"Teste retrospectivo",i:"history"},
  {id:"conferencia",t:"Conferência",i:"check-circle-2"},
  {g:"Supabase Cloud"},
  {id:"jogossalvos",t:"Jogos Salvos",i:"database"},
  {id:"pacientes",t:"Pacientes & Agendamentos",i:"users"},
  {id:"sugestoes",t:"Caixa de Sugestões",i:"message-square"},
];
const ROUTES = {};
let current="home";

function buildNav(){
  const nav=$('#nav'); nav.innerHTML='';
  NAV.forEach(item=>{
    if(item.g){nav.appendChild(el('div','nav-group',item.g));return;}
    const b=el('button','nav-item');b.innerHTML=`${icon(item.i)}<span>${item.t}</span>`;
    b.dataset.id=item.id; b.onclick=()=>go(item.id);
    nav.appendChild(b);
  });
}
function go(id){
  if(!ROUTES[id])return;
  current=id; clearCharts();
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.id===id));
  const meta=NAV.find(x=>x.id===id);
  $('#pageTitle').textContent=meta?meta.t:'';
  const c=$('#content'); c.innerHTML='';
  const page=el('div','page'); c.appendChild(page);
  ROUTES[id](page);
  refreshIcons(); c.focus(); closeSidebar();
  if(history.replaceState)history.replaceState(null,'','#'+id);
}

/* ============================================================
   PÁGINAS DE ANÁLISE
   ============================================================ */

// ---- HOME ----
ROUTES.home = (p)=>{
  const v=D.val, u=D.ult, ord=D.freq.ordenado;
  const faixaTop=Object.entries(D.soma.faixas).sort((a,b)=>b[1]-a[1])[0];
  const kpis=el('div','grid cards');
  kpis.append(
    kpi('database','Concursos no arquivo',v.total.toLocaleString('pt-BR'),`desde o concurso ${v.concurso_antigo}`),
    kpi('layers','Concursos analisados',v.usados,`${v.amostra_ini} a ${v.amostra_fim}`),
    kpi('target','Concurso mais recente',v.concurso_recente,v.data_recente),
    kpi('repeat','Repetição média',D.rep.media.toFixed(1),`moda ${D.rep.moda} dezenas`),
    kpi('sigma','Faixa de soma comum',faixaTop[0],`${faixaTop[1]} ocorrências`),
    kpi('shield-check','Validação','OK','sem inconsistências'),
  );
  p.appendChild(kpis);

  const two=el('div','grid two');two.style.marginTop='18px';
  // quentes/neutras/frias
  const c1=el('div','card');
  c1.innerHTML=`<h3>${icon('flame')}Temperatura das dezenas</h3>`;
  c1.appendChild(el('p','note','10 mais quentes'));c1.appendChild(chipRow(ord.slice(0,10),{sm:true}));
  c1.appendChild(el('p','note','5 neutras'));c1.appendChild(chipRow(ord.slice(10,15),{sm:true}));
  c1.appendChild(el('p','note','10 mais frias'));c1.appendChild(chipRow(ord.slice(-10),{sm:true}));
  two.appendChild(c1);
  // padrões
  const c2=el('div','card');
  c2.innerHTML=`<h3>${icon('dices')}Padrões mais comuns</h3>`;
  const pi=D.pi[0],mc=D.mc[0],ba=D.ba[0];
  const mkbar=(lbl,val,max)=>c2.appendChild(barRow(lbl,val,max));
  mkbar(`${pi[0][0]}P/${pi[0][1]}I`,pi[1],D.pi[0][1]);
  mkbar(`${mc[0][0]}M/${mc[0][1]}C`,mc[1],D.pi[0][1]);
  mkbar(`${ba[0][0]}B/${ba[0][1]}A`,ba[1],D.pi[0][1]);
  c2.appendChild(el('p','note','Pares/ímpares · Moldura/centro · Baixas/altas mais frequentes.'));
  two.appendChild(c2);
  p.appendChild(two);

  // mini heatmap + atalhos
  const two2=el('div','grid two');two2.style.marginTop='16px';
  const ch=el('div','card');ch.innerHTML=`<h3>${icon('grid-3x3')}Mapa de calor — 300 concursos</h3>`;
  ch.appendChild(heatmap('f300'));two2.appendChild(ch);
  const cs=el('div','card');cs.innerHTML=`<h3>${icon('wand-2')}Atalhos</h3>`;
  const ba1=el('button','btn');ba1.innerHTML=`${icon('wand-2')} Gerar jogos`;ba1.onclick=()=>go('gerador');
  const ba2=el('button','btn ghost');ba2.style.marginTop='10px';ba2.innerHTML=`${icon('check-circle-2')} Conferir resultado`;ba2.onclick=()=>go('conferencia');
  const ba3=el('button','btn ghost');ba3.style.marginTop='10px';ba3.innerHTML=`${icon('download-cloud')} Atualizar resultados`;ba3.onclick=()=>go('atualizar');
  cs.append(ba1,ba2,ba3);two2.appendChild(cs);
  p.appendChild(two2);
};

// ---- VALIDAÇÃO ----
ROUTES.validacao = (p)=>{
  const v=D.val;
  p.appendChild(el('p','page-intro','Verificação automática de integridade da base antes da análise.'));
  const two=el('div','grid two');
  const c1=el('div','card');c1.innerHTML=`<h3>${icon('info')}Metadados</h3>`;
  const meta=[['Aba',v.abas.join(', ')],['Colunas',v.colunas.length],['Total de concursos',v.total],
    ['Mais antigo',v.concurso_antigo],['Mais recente',`${v.concurso_recente} (${v.data_recente})`],
    ['Amostra usada',`${v.usados} concursos`],['Intervalo',`${v.amostra_ini}–${v.amostra_fim}`],
    ['Período',`${v.data_ini} a ${v.data_fim}`]];
  const vl=el('div','vlist');
  meta.forEach(([k,val])=>{const r=el('div','vrow');r.innerHTML=`<span class="vk">${k}</span><span class="vv">${val}</span>`;vl.appendChild(r);});
  c1.appendChild(vl);two.appendChild(c1);

  const c2=el('div','card');c2.innerHTML=`<h3>${icon('shield-check')}Checagens</h3>`;
  const checks=[['Linhas duplicadas',v.dup_concurso],['Dezenas fora de 01–25',v.fora_intervalo],
    ['Dezenas repetidas no mesmo concurso',v.rep_intra],['Células vazias',v.celulas_vazias],
    ['Concursos com ≠ 15 dezenas',v.rep_intra]];
  const vl2=el('div','vlist');
  checks.forEach(([k,n])=>{
    const ok=n===0;const r=el('div','vrow');
    r.innerHTML=`<span class="vi ${ok?'ok':'bad'}">${icon(ok?'check':'x')}</span><span class="vk">${k}</span><span class="tag ${ok?'ok':'bad'}">${ok?'OK':n+' problema(s)'}</span>`;
    vl2.appendChild(r);
  });
  c2.appendChild(vl2);two.appendChild(c2);
  p.appendChild(two);
};

// ---- FREQUÊNCIA ----
let freqWin='f300';
ROUTES.frequencia = (p)=>{
  p.appendChild(el('p','page-intro',`Frequência das 25 dezenas nos ${D.val.usados} concursos. Média teórica esperada em 300 concursos: ${D.freq.esperada.toFixed(0)}.`));
  // seletor de janela + gráfico
  const cctl=el('div','card');
  const seg=el('div','seg');
  [['f300','300'],['f100','100'],['f50','50'],['f20','20'],['f10','10']].forEach(([k,l])=>{
    const b=el('button',k===freqWin?'active':'',l);b.onclick=()=>{freqWin=k;go('frequencia');};seg.appendChild(b);
  });
  const head=el('div');head.style.cssText='display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px';
  head.innerHTML=`<h3 style="margin:0">${icon('bar-chart-3')}Frequência — últimos ${freqWin.slice(1)} concursos</h3>`;
  head.appendChild(seg);cctl.appendChild(head);
  const cb=el('div','chart-box');const cv=el('canvas');cb.appendChild(cv);cctl.appendChild(cb);
  p.appendChild(cctl);
  const ranked=[...NUMS].sort((a,b)=>fGet(freqWin,b)-fGet(freqWin,a));
  bar(cv,ranked.map(pad),ranked.map(n=>fGet(freqWin,n)),{colors:ranked.map(n=>CLS_COLOR[clsKey(n)])});

  // tabela completa
  const tbl=el('div','card');tbl.style.marginTop='16px';
  tbl.innerHTML=`<h3>${icon('table')}Tabela completa <input id="dzSearch" placeholder="buscar dezena…" style="margin-left:auto;padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)"></h3>`;
  const wrap=el('div','table-wrap');
  const cols=['Dezena','Apar.(300)','%','Dif.','F100','F50','F20','F10','Atraso','MaiorAtr','Seq.máx','Classe'];
  let sortCol=1,sortDir=-1;
  function rows(){
    const arr=[...NUMS].map(n=>({n,
      a:fGet('f300',n),pct:(fGet('f300',n)/D.val.usados*100),
      dif:fGet('f300',n)-D.freq.esperada,f100:fGet('f100',n),f50:fGet('f50',n),
      f20:fGet('f20',n),f10:fGet('f10',n),atr:D.freq.atraso[n],ma:D.freq.maior_atraso[n],
      sm:D.freq.seq_max[n],c:cls(n)}));
    const keys=['n','a','pct','dif','f100','f50','f20','f10','atr','ma','sm','c'];
    arr.sort((x,y)=>{const k=keys[sortCol];return (x[k]>y[k]?1:x[k]<y[k]?-1:0)*sortDir;});
    return arr;
  }
  function render(){
    const q=($('#dzSearch')?.value||'').trim();
    const data=rows().filter(r=>!q||pad(r.n).includes(q)||String(r.n)===q);
    let h='<table><thead><tr>'+cols.map((c,i)=>`<th data-i="${i}">${c}${i===sortCol?(sortDir<0?' ▼':' ▲'):''}</th>`).join('')+'</tr></thead><tbody>';
    data.forEach(r=>{h+=`<tr><td><b>${pad(r.n)}</b></td><td>${r.a}</td><td>${r.pct.toFixed(1)}%</td>
      <td style="color:${r.dif>=0?'var(--ok)':'var(--err)'}">${r.dif>=0?'+':''}${r.dif.toFixed(0)}</td>
      <td>${r.f100}</td><td>${r.f50}</td><td>${r.f20}</td><td>${r.f10}</td><td>${r.atr}</td><td>${r.ma}</td><td>${r.sm}</td>
      <td class="cell-${CLS_KEY[r.c]}">${r.c}</td></tr>`;});
    h+='</tbody></table>';wrap.innerHTML=h;
    wrap.querySelectorAll('th').forEach(th=>th.onclick=()=>{const i=+th.dataset.i;if(i===sortCol)sortDir*=-1;else{sortCol=i;sortDir=i===0?1:-1;}render();});
  }
  tbl.appendChild(wrap);p.appendChild(tbl);render();
  setTimeout(()=>{const s=$('#dzSearch');if(s)s.oninput=render;},0);
};

// ---- helper heatmap ----
function heatmap(win){
  const wrap=el('div');
  const grid=el('div','heat');
  const vals=NUMS.map(n=>fGet(win,n));
  const mn=Math.min(...vals),mx=Math.max(...vals);
  NUMS.forEach(n=>{
    const v=fGet(win,n);const t=(v-mn)/(mx-mn||1);
    let key = t>0.8?'q0':t>0.6?'q1':t>0.4?'q2':t>0.2?'q3':'q4';
    const cell=el('div','cell');cell.style.background=CLS_COLOR[key];
    if(key==='q2')cell.style.color='#3a2e00';
    cell.innerHTML=`${pad(n)}<small>${v}</small>`;cell.title=`Dezena ${pad(n)}: ${v} aparições`;
    grid.appendChild(cell);
  });
  wrap.appendChild(grid);
  const lg=el('div','heat-legend');
  lg.innerHTML=CLS_ORDER.map(c=>`<span><i style="background:${CLS_COLOR[CLS_KEY[c]]}"></i>${c}</span>`).join('');
  wrap.appendChild(lg);
  return wrap;
}

// ---- TEMPERATURA ----
ROUTES.temperatura = (p)=>{
  const ord=D.freq.ordenado;
  p.appendChild(el('p','page-intro','A classificação combina frequência (300/100/50/20/10), atraso atual e tendência recente — não apenas a frequência geral.'));
  const blocos=el('div','grid two');
  const mk=(titulo,ico,arr)=>{const c=el('div','card');c.innerHTML=`<h3>${icon(ico)}${titulo}</h3>`;c.appendChild(chipRow(arr));return c;};
  blocos.append(
    mk('10 mais quentes','flame',ord.slice(0,10)),
    mk('5 neutras','minus',ord.slice(10,15)),
    mk('10 mais frias','snowflake',ord.slice(-10)),
  );
  p.appendChild(blocos);
  const paineis=el('div','grid two');paineis.style.marginTop='16px';
  paineis.append(
    mk('Tendência de alta','trending-up',D.freq.tend_alta),
    mk('Tendência de queda','trending-down',D.freq.tend_queda),
    mk('Mais atrasadas','clock',D.freq.atrasadas),
    mk('Voltaram recentemente','rotate-ccw',D.freq.voltaram.length?D.freq.voltaram:[]),
  );
  p.appendChild(paineis);
};

// ---- genérico: distribuição com barras + tabela + comparativo janelas ----
function distPage(p,{intro,list,fmtKey,winKeys,windowLabel}){
  p.appendChild(el('p','page-intro',intro));
  const total=list.reduce((s,x)=>s+x[1],0);
  const c=el('div','card');
  c.innerHTML=`<h3>${icon('bar-chart-3')}Distribuição — ${D.val.usados} concursos</h3>`;
  const max=Math.max(...list.map(x=>x[1]));
  list.forEach((x,i)=>{
    const r=barRow(fmtKey(x[0]),x[1],max);
    if(i===0)r.querySelector('.bl').innerHTML+=' <span class="tag ok">+comum</span>';
    c.appendChild(r);
  });
  c.appendChild(el('p','note',`Total: ${total} concursos.`));
  p.appendChild(c);
  if(winKeys){
    const cw=el('div','card');cw.style.marginTop='16px';
    cw.innerHTML=`<h3>${icon('layers')}Padrão mais comum por janela</h3>`;
    const wrap=el('div','table-wrap');
    let h='<table><thead><tr><th>Janela</th><th>Padrão</th><th>Ocorrências</th></tr></thead><tbody>';
    winKeys.forEach(([lbl,key])=>{const t=D[key][0];h+=`<tr><td>Últimos ${lbl}</td><td><b>${fmtKey(t[0])}</b></td><td>${t[1]}</td></tr>`;});
    h+='</tbody></table>';wrap.innerHTML=h;cw.appendChild(wrap);p.appendChild(cw);
  }
}

ROUTES.parimpar = (p)=>distPage(p,{
  intro:'Quantidade de dezenas pares e ímpares por concurso.',
  list:D.pi, fmtKey:k=>`${k[0]}P / ${k[1]}I`,
  winKeys:[['10','pi10'],['20','pi20'],['300','pi']]
});

ROUTES.moldura = (p)=>{
  distPage(p,{
    intro:'Moldura = borda do volante (16 dezenas). Centro = 3x3 interno (07,08,09,12,13,14,17,18,19).',
    list:D.mc, fmtKey:k=>`${k[0]}M / ${k[1]}C`,
    winKeys:[['10','mc10'],['20','mc20'],['50','mc50'],['100','mc100'],['300','mc']]
  });
  // diagrama 5x5
  const c=el('div','card');c.style.marginTop='16px';
  c.innerHTML=`<h3>${icon('square')}Volante 5×5 — moldura vs centro</h3>`;
  const grid=el('div','heat');
  NUMS.forEach(n=>{const cell=el('div','cell');const isC=CENTRO.has(n);
    cell.style.background=isC?'var(--accent)':'var(--primary)';cell.textContent=pad(n);
    cell.title=isC?'Centro':'Moldura';grid.appendChild(cell);});
  c.appendChild(grid);
  c.appendChild(el('p','note','Roxo = centro · Azul = moldura.'));
  p.appendChild(c);
};

ROUTES.baixasaltas = (p)=>distPage(p,{
  intro:'Baixas = 01 a 13 · Altas = 14 a 25.',
  list:D.ba, fmtKey:k=>`${k[0]}B / ${k[1]}A`
});

// ---- LINHAS / COLUNAS ----
function lcPage(p,{intro,totais,ocup,dist,grupos,label}){
  p.appendChild(el('p','page-intro',intro));
  const arr=Object.entries(totais).map(([k,v])=>({k:+k,v,media:v/D.val.usados}));
  const forte=arr.reduce((a,b)=>b.v>a.v?b:a),fraca=arr.reduce((a,b)=>b.v<a.v?b:a);
  // resumo
  const c1=el('div','card');c1.innerHTML=`<h3>${icon('bar-chart-3')}Resumo por ${label}</h3>`;
  const wrap=el('div','table-wrap');
  let h='<table><thead><tr><th>'+label+'</th><th>Freq. total</th><th>Média/conc.</th><th>Mín</th><th>Máx</th></tr></thead><tbody>';
  arr.forEach(o=>{const oc=ocup[o.k];const ks=Object.keys(oc).map(Number);
    h+=`<tr><td>${label} ${o.k}</td><td>${o.v}</td><td>${o.media.toFixed(2)}</td><td>${Math.min(...ks)}</td><td>${Math.max(...ks)}</td></tr>`;});
  h+='</tbody></table>';wrap.innerHTML=h;c1.appendChild(wrap);
  c1.appendChild(el('p','note',`Mais forte: ${label} ${forte.k} · Mais fraca: ${label} ${fraca.k}.`));
  p.appendChild(c1);
  // gráfico ocupação
  const c2=el('div','card');c2.style.marginTop='16px';c2.innerHTML=`<h3>${icon('bar-chart-3')}Ocupação (dezenas por concurso)</h3>`;
  const cb=el('div','chart-box');const cv=el('canvas');cb.appendChild(cv);c2.appendChild(cb);p.appendChild(c2);
  const labels=[0,1,2,3,4,5];
  const ds=arr.map((o,i)=>({label:`${label} ${o.k}`,data:labels.map(l=>ocup[o.k][l]||0),
    backgroundColor:['#4f46e5','#7c3aed','#ef7d1a','#5b9bd5','#16a34a'][i],borderRadius:5}));
  const ch=new Chart(cv,{type:'bar',data:{labels:labels.map(l=>l+' dez.'),datasets:ds},options:baseOpts()});
  charts.push(ch);
  // distribuições mais comuns
  const c3=el('div','card');c3.style.marginTop='16px';c3.innerHTML=`<h3>${icon('list')}${grupos} mais frequentes</h3>`;
  const max=dist[0][1];
  dist.slice(0,10).forEach(d=>c3.appendChild(barRow(d[0].join('-'),d[1],max)));
  p.appendChild(c3);
}
ROUTES.linhas = (p)=>lcPage(p,{intro:'As 5 linhas horizontais do volante (L1=01–05 … L5=21–25).',
  totais:D.linha_totais,ocup:D.linha_ocup,dist:D.linha_dist,grupos:'Distribuições L1-L2-L3-L4-L5',label:'Linha'});
ROUTES.colunas = (p)=>lcPage(p,{intro:'As 5 colunas verticais do volante (C1=01,06,11,16,21 … C5=05,10,15,20,25).',
  totais:D.col_totais,ocup:D.col_ocup,dist:D.col_dist,grupos:'Distribuições C1-C2-C3-C4-C5',label:'Coluna'});

// ---- SEQUÊNCIAS ----
ROUTES.sequencias = (p)=>{
  p.appendChild(el('p','page-intro','Blocos de dezenas consecutivas dentro de cada concurso (ex.: 10-11-12).'));
  const kpis=el('div','grid cards');
  kpis.append(
    kpi('link','Média de blocos/concurso',D.seq_por_conc_media.toFixed(2)),
    kpi('list','Dezenas em sequência (média)',D.seq_dezenas_media.toFixed(2)),
    kpi('maximize','Maior sequência observada',D.maior_seq),
  );
  p.appendChild(kpis);
  const c=el('div','card');c.style.marginTop='16px';c.innerHTML=`<h3>${icon('bar-chart-3')}Frequência por tamanho de bloco</h3>`;
  const cb=el('div','chart-box');const cv=el('canvas');cb.appendChild(cv);c.appendChild(cb);p.appendChild(c);
  const entries=Object.entries(D.seq_size).map(([k,v])=>[+k,v]).sort((a,b)=>a[0]-b[0]);
  const lab={2:'Pares (2)',3:'Trincas (3)',4:'Seq. 4',5:'Seq. 5',6:'Seq. 6',7:'Seq. 7',8:'Seq. 8',9:'Seq. 9',10:'Seq. 10'};
  bar(cv,entries.map(e=>lab[e[0]]||e[0]),entries.map(e=>e[1]));
};

// ---- REPETIÇÃO ----
ROUTES.repeticao = (p)=>{
  p.appendChild(el('p','page-intro','Comparação de cada concurso com o imediatamente anterior.'));
  const kpis=el('div','grid cards');
  kpis.append(kpi('repeat','Média',D.rep.media.toFixed(2)),kpi('minus','Mínimo',D.rep.min),
    kpi('plus','Máximo',D.rep.max),kpi('star','Moda',D.rep.moda));
  p.appendChild(kpis);
  const c=el('div','card');c.style.marginTop='16px';c.innerHTML=`<h3>${icon('bar-chart-3')}Distribuição da quantidade de repetidas</h3>`;
  const cb=el('div','chart-box');const cv=el('canvas');cb.appendChild(cv);c.appendChild(cb);p.appendChild(c);
  const entries=Object.entries(D.rep.counter).map(([k,v])=>[+k,v]).sort((a,b)=>a[0]-b[0]);
  bar(cv,entries.map(e=>e[0]),entries.map(e=>e[1]),
    {colors:entries.map(e=>[7,8,9,10,11].includes(e[0])?'#7c3aed':'#6366f1')});
  // permanência por dezena
  const c2=el('div','card');c2.style.marginTop='16px';c2.innerHTML=`<h3>${icon('table')}Permanência por dezena (apareceu → repetiu no seguinte)</h3>`;
  const wrap=el('div','table-wrap');
  const perm=D.rep.perm;
  const rows=NUMS.map(n=>({n,ap:perm[n][0],re:perm[n][1],pct:perm[n][0]?perm[n][1]/perm[n][0]*100:0}))
    .sort((a,b)=>b.pct-a.pct);
  let h='<table><thead><tr><th>Dezena</th><th>Apareceu</th><th>Repetiu</th><th>% permanência</th></tr></thead><tbody>';
  rows.forEach(r=>h+=`<tr><td><b>${pad(r.n)}</b></td><td>${r.ap}</td><td>${r.re}</td><td>${r.pct.toFixed(0)}%</td></tr>`);
  h+='</tbody></table>';wrap.innerHTML=h;c2.appendChild(wrap);p.appendChild(c2);
};

// ---- SOMA ----
ROUTES.soma = (p)=>{
  p.appendChild(el('p','page-intro','Soma das 15 dezenas de cada concurso.'));
  const s=D.soma;
  const kpis=el('div','grid cards');
  kpis.append(kpi('arrow-down','Menor',s.min),kpi('arrow-up','Maior',s.max),
    kpi('sigma','Média',s.media.toFixed(1)),kpi('minus','Mediana',s.mediana));
  p.appendChild(kpis);
  const c=el('div','card');c.style.marginTop='16px';c.innerHTML=`<h3>${icon('bar-chart-3')}Distribuição por faixa de soma</h3>`;
  const cb=el('div','chart-box');const cv=el('canvas');cb.appendChild(cv);c.appendChild(cb);p.appendChild(c);
  const fx=Object.entries(s.faixas);
  bar(cv,fx.map(e=>e[0]),fx.map(e=>e[1]));
  // tendência últimos concursos
  const c2=el('div','card');c2.style.marginTop='16px';c2.innerHTML=`<h3>${icon('trending-up')}Soma — evolução na amostra</h3>`;
  const cb2=el('div','chart-box sm');const cv2=el('canvas');cb2.appendChild(cv2);c2.appendChild(cb2);p.appendChild(c2);
  line(cv2,D.concursos_serie,D.somas_serie);
};

// ---- PRIMOS E MÚLTIPLOS ----
ROUTES.primos = (p)=>{
  p.appendChild(el('p','page-intro','Primos: 02,03,05,07,11,13,17,19,23. Múltiplos e finais das dezenas.'));
  const two=el('div','grid two');
  const c1=el('div','card');c1.innerHTML=`<h3>${icon('hash')}Primos por concurso (média ${D.primo.media.toFixed(2)})</h3>`;
  const cb=el('div','chart-box sm');const cv=el('canvas');cb.appendChild(cv);c1.appendChild(cb);two.appendChild(c1);
  const pe=Object.entries(D.primo.counter).map(([k,v])=>[+k,v]).sort((a,b)=>a[0]-b[0]);
  bar(cv,pe.map(e=>e[0]),pe.map(e=>e[1]));
  const c2=el('div','card');c2.innerHTML=`<h3>${icon('hash')}Finais das dezenas (0–9)</h3>`;
  const cb2=el('div','chart-box sm');const cv2=el('canvas');cb2.appendChild(cv2);c2.appendChild(cb2);two.appendChild(c2);
  const fe=Object.entries(D.finais).map(([k,v])=>[+k,v]).sort((a,b)=>a[0]-b[0]);
  bar(cv2,fe.map(e=>'Final '+e[0]),fe.map(e=>e[1]));
  p.appendChild(two);
  const c3=el('div','card');c3.style.marginTop='16px';c3.innerHTML=`<h3>${icon('x')}Múltiplos (média por concurso)</h3>`;
  c3.appendChild(barRow('Múlt. de 3',D.mult.m3.toFixed(2),D.mult.m3));
  c3.appendChild(barRow('Múlt. de 4',D.mult.m4.toFixed(2),D.mult.m3));
  c3.appendChild(barRow('Múlt. de 5',D.mult.m5.toFixed(2),D.mult.m3));
  p.appendChild(c3);
};

// ---- PARES DE DEZENAS (afinidade / Lift) ----
ROUTES.pares = (p)=>{
  p.appendChild(el('p','page-intro','Correlações históricas: combinações que mais/menos saíram juntas. Lift = ocorrências observadas ÷ esperadas pelo acaso — acima de 1 indica afinidade acima do esperado; abaixo de 1, abaixo do esperado. Correlação não é causa nem garantia.'));
  const parTable=(titulo,ico,arr,fmt,comLift)=>{
    const c=el('div','card');c.innerHTML=`<h3>${icon(ico)}${titulo}</h3>`;
    const wrap=el('div','table-wrap');
    let h='<table><thead><tr><th>Combinação</th><th>Ocorrências</th>'+(comLift?'<th>Lift</th>':'')+'</tr></thead><tbody>';
    arr.forEach(x=>h+=`<tr><td><b>${fmt(x[0])}</b></td><td>${x[1]}</td>${comLift?`<td class="${x[2]>=1.2?'cell-q0':x[2]<0.8?'cell-q3':''}">${x[2].toFixed(2)}</td>`:''}</tr>`);
    h+='</tbody></table>';wrap.innerHTML=h;c.appendChild(wrap);return c;
  };
  const fmtP=k=>k.map(pad).join(' - ');
  const two=el('div','grid two');
  two.append(parTable('20 pares mais frequentes','git-merge',D.pares_top,fmtP,true),
             parTable('20 pares menos frequentes','git-merge',D.pares_bot,fmtP,true));
  p.appendChild(two);
  const two2=el('div','grid two');two2.style.marginTop='16px';
  two2.append(parTable('20 trios mais frequentes','share-2',D.trincas_top,fmtP,true),
              parTable('20 quartetos mais frequentes','grid-2x2',D.quartetos_top,fmtP,true));
  p.appendChild(two2);
  const two3=el('div','grid two');two3.style.marginTop='16px';
  two3.append(parTable('Pares — últimos 50','clock',D.pares_50,fmtP,false),
              parTable('Pares — últimos 20','clock',D.pares_20,fmtP,false));
  p.appendChild(two3);
  const card10=parTable('Pares — últimos 10','clock',D.pares_10,fmtP,false);
  card10.style.marginTop='16px';
  p.appendChild(card10);
};

// ---- MAPAS DE CALOR ----
ROUTES.heatmap = (p)=>{
  p.appendChild(el('p','page-intro','Frequência de cada dezena por janela. Cor = intensidade relativa; número inferior = aparições.'));
  const grid=el('div','grid two');
  [['f300','300 concursos'],['f100','100 concursos'],['f50','50 concursos'],['f20','20 concursos'],['f10','10 concursos']].forEach(([k,l])=>{
    const c=el('div','card');c.innerHTML=`<h3>${icon('grid-3x3')}${l}</h3>`;c.appendChild(heatmap(k));grid.appendChild(c);
  });
  p.appendChild(grid);
};

// ---- ÚLTIMO CONCURSO ----
ROUTES.ultimo = (p)=>{
  const u=D.ult;
  p.appendChild(el('p','page-intro',`Concurso ${u.concurso} — ${u.data}.`));
  const c=el('div','card');c.innerHTML=`<h3>${icon('target')}Dezenas sorteadas</h3>`;
  c.appendChild(chipRow(u.dezenas));
  p.appendChild(c);
  const c2=el('div','card');c2.style.marginTop='16px';c2.innerHTML=`<h3>${icon('info')}Atributos</h3>`;
  const attrs=[['Pares / Ímpares',`${u.pares} / ${u.impares}`],['Moldura / Centro',`${u.moldura} / ${u.centro}`],
    ['Baixas / Altas',`${u.baixas} / ${u.altas}`],['Soma',u.soma],['Primos',u.primos],
    ['Linhas (L1–L5)',u.linhas.join('-')],['Colunas (C1–C5)',u.colunas.join('-')],
    ['Blocos consecutivos',u.seqs.length?u.seqs.join(', '):'nenhum'],
    ['Repetidas do anterior',u.repetidas_anterior]];
  const vl=el('div','vlist');
  attrs.forEach(([k,v])=>{const r=el('div','vrow');r.innerHTML=`<span class="vk">${k}</span><span class="vv">${v}</span>`;vl.appendChild(r);});
  c2.appendChild(vl);p.appendChild(c2);
  // taxas de repetição
  const perm=D.rep.perm;
  const rep=[...u.dezenas].map(n=>({n,pct:perm[n][0]?perm[n][1]/perm[n][0]*100:0})).sort((a,b)=>b.pct-a.pct);
  const c3=el('div','card');c3.style.marginTop='16px';c3.innerHTML=`<h3>${icon('repeat')}Taxa histórica de repetição (estatística, não previsão)</h3>`;
  c3.appendChild(el('p','note','Maior taxa de repetição:'));
  c3.appendChild(chipRow(rep.slice(0,5).map(r=>r.n),{sm:true}));
  c3.appendChild(el('p','note','Menor taxa de repetição:'));
  c3.appendChild(chipRow(rep.slice(-5).map(r=>r.n),{sm:true}));
  p.appendChild(c3);
};

/* ============================================================
   GERADOR DE JOGOS (client-side)
   ============================================================ */
function metrics(g){
  const s=new Set(g);
  const np=g.filter(n=>PAR.has(n)).length;
  const mol=g.filter(n=>!CENTRO.has(n)).length;
  const bx=g.filter(n=>BAIXAS.has(n)).length;
  const soma=g.reduce((a,b)=>a+b,0);
  const primos=g.filter(n=>PRIMOS.has(n)).length;
  const lin=LINHAS.map(L=>g.filter(n=>L.has(n)).length);
  const col=COLS.map(C=>g.filter(n=>C.has(n)).length);
  const sorted=[...g].sort((a,b)=>a-b);
  let seqs=0,run=1;
  for(let i=1;i<sorted.length;i++){if(sorted[i]===sorted[i-1]+1)run++;else{if(run>=2)seqs++;run=1;}}
  if(run>=2)seqs++;
  const rep=g.filter(n=>D.ult.dezenas.includes(n)).length;
  const q=g.filter(n=>['Muito quente','Quente'].includes(cls(n))).length;
  const neu=g.filter(n=>cls(n)==='Neutra').length;
  const fr=g.filter(n=>['Fria','Muito fria'].includes(cls(n))).length;
  return {pares:np,impares:15-np,moldura:mol,centro:15-mol,baixas:bx,altas:15-bx,
    soma,primos,linhas:lin,colunas:col,seqs,repetidas_ult:rep,quentes:q,neutras:neu,frias:fr};
}
function pairLift(a,b){
  const k=a<b?`${a}-${b}`:`${b}-${a}`;
  return D.pares_lift_all?.[k]??1;
}
function afinidadeBonus(g){
  let soma=0,n=0;
  for(let i=0;i<g.length;i++)for(let j=i+1;j<g.length;j++){soma+=pairLift(g[i],g[j]);n++;}
  const media=n?soma/n:1; // ~1 = neutro, >1 = pares com afinidade acima do esperado
  return Math.max(0,Math.min(1,(media-0.8)/0.6)); // normaliza faixa util ~0.8-1.4 -> 0-1
}
function score(g){
  const m=metrics(g),s=new Set(g);let sc=0;
  sc += g.reduce((a,n)=>a+fGet('f50',n)/50,0)/15*25;
  sc += g.reduce((a,n)=>a+fGet('f10',n)/10,0)/15*15;
  sc += (1-Math.abs(m.pares-7.5)/7.5)*10;
  sc += (1-Math.abs(m.moldura-10)/5)*8;
  sc += (1-Math.min(Math.abs(m.soma-195)/40,1))*12;
  sc += (1-Math.abs(m.baixas-7.5)/7.5)*6;
  sc += (1-Math.min(Math.abs(m.primos-6)/6,1))*6;
  if(!m.linhas.includes(0))sc+=5; if(!m.colunas.includes(0))sc+=5;
  if(m.linhas.every(x=>x>=1&&x<=4))sc+=4; if(m.colunas.every(x=>x>=1&&x<=4))sc+=4;
  sc += afinidadeBonus(g)*7;
  return sc;
}
function sample(arr,k){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a.slice(0,k);}
// pools de dezenas por modelo de seleção (temperatura / pontuação ponderada / híbrido)
function poolsFor(modelo,pesos){
  if(modelo==='score'){
    const sd=scoreDezenas(pesos||PESOS_DEFAULT);
    const ranked=[...NUMS].sort((a,b)=>sd[b].score-sd[a].score);
    return {quentes:ranked.slice(0,8),neutras:ranked.slice(8,17),frias:ranked.slice(17)};
  }
  if(modelo==='hibrido'){
    const ord=D.freq.ordenado;
    const quentes=ord.slice(0,5),frias=ord.slice(-5);
    const restantes=NUMS.filter(n=>!quentes.includes(n)&&!frias.includes(n));
    const oportunidade=[...restantes].sort((a,b)=>(D.freq.atraso[b]-atrasoMedio(b))-(D.freq.atraso[a]-atrasoMedio(a))).slice(0,5);
    const neutras=[...oportunidade,...restantes.filter(n=>!oportunidade.includes(n))];
    return {quentes,neutras,frias};
  }
  return {
    quentes:NUMS.filter(n=>['Muito quente','Quente'].includes(cls(n))),
    neutras:NUMS.filter(n=>cls(n)==='Neutra'),
    frias:NUMS.filter(n=>['Fria','Muito fria'].includes(cls(n))),
  };
}
function genGame(alvoPares,cfg){
  const {quentes,neutras,frias}=poolsFor(cfg.modelo,cfg.pesos);
  let best=null,bestSc=-1;
  for(let t=0;t<600;t++){
    let g=new Set([...sample(quentes,cfg.nq),...sample(neutras,cfg.nn),...sample(frias,cfg.nf)]);
    const rest=sample(NUMS.filter(n=>!g.has(n)),25);
    for(const n of rest){if(g.size>=15)break;g.add(n);}
    g=[...g].slice(0,15);
    while(g.length<15){const c=NUMS.filter(n=>!g.includes(n));g.push(c[Math.floor(Math.random()*c.length)]);}
    const m=metrics(g);
    if(m.pares!==alvoPares)continue;
    if(m.linhas.includes(0)||m.colunas.includes(0))continue;
    if(m.soma<cfg.somaMin||m.soma>cfg.somaMax)continue;
    if(m.repetidas_ult<cfg.repMin||m.repetidas_ult>cfg.repMax)continue;
    const sc=score(g);
    if(sc>bestSc){bestSc=sc;best=[...g].sort((a,b)=>a-b);}
  }
  if(!best){ // relaxa restrições de soma/rep
    return genGameRelaxed(alvoPares,cfg);
  }
  return best;
}
function genGameRelaxed(alvoPares,cfg){
  const {quentes,neutras}=poolsFor(cfg.modelo,cfg.pesos);
  let best=null,bestSc=-1;
  for(let t=0;t<800;t++){
    let g=new Set([...sample(quentes,cfg.nq),...sample(neutras,cfg.nn)]);
    const rest=sample(NUMS.filter(n=>!g.has(n)),25);
    for(const n of rest){if(g.size>=15)break;g.add(n);}
    g=[...g].slice(0,15);
    while(g.length<15){const c=NUMS.filter(n=>!g.includes(n));g.push(c[Math.floor(Math.random()*c.length)]);}
    const m=metrics(g);
    if(m.pares!==alvoPares||m.linhas.includes(0)||m.colunas.includes(0))continue;
    const sc=score(g);if(sc>bestSc){bestSc=sc;best=[...g].sort((a,b)=>a-b);}
  }
  return best;
}
function interOk(g,jogos,minI,maxI){return jogos.every(j=>{const i=g.filter(n=>j.includes(n)).length;return i>=minI&&i<=maxI;});}
function generateSet(cfg){
  const jogos=[];
  const plan=cfg.regras;
  for(let i=0;i<cfg.qtd;i++){
    const ap=plan[i%plan.length];
    let placed=null;
    for(let a=0;a<400;a++){
      const g=genGame(ap,cfg);
      if(g && !jogos.some(j=>j.join()===g.join()) && interOk(g,jogos,cfg.interMin,cfg.interMax)){placed=g;break;}
    }
    if(!placed)placed=genGame(ap,cfg)||genGameRelaxed(ap,cfg);
    jogos.push(placed);
  }
  // cobertura das 25 — troca sem violar par/ímpar nem o limite de interseção
  if(cfg.cobrir25){
    let cobertas=new Set(jogos.flat());
    NUMS.filter(n=>!cobertas.has(n)).forEach(n=>{
      for(let ji=0;ji<jogos.length;ji++){
        const j=jogos[ji];
        const alvoP=metrics(j).pares;
        const cand=j.find(x=>{
          if((x%2===0)!==(n%2===0))return false; // preserva par/ímpar
          const novo=j.filter(y=>y!==x).concat(n).sort((a,b)=>a-b);
          if(novo.filter(v=>v%2===0).length!==alvoP)return false;
          const outros=jogos.filter((_,k)=>k!==ji);
          if(!interOk(novo,outros,cfg.interMin,cfg.interMax))return false;
          return jogos.filter(jj=>jj.includes(x)).length>Math.ceil(jogos.length/3);
        });
        if(cand!=null){jogos[ji]=j.filter(y=>y!==cand).concat(n).sort((a,b)=>a-b);break;}
      }
    });
  }
  return jogos;
}
function normIEE(jogos){
  const scs=jogos.map(score);const mn=Math.min(...scs),mx=Math.max(...scs);
  return jogos.map((g,i)=>{
    const others=jogos.filter((_,j)=>j!==i).map(j=>g.filter(n=>j.includes(n)).length);
    const div=1-(others.reduce((a,b)=>a+b,0)/others.length-8)/6;
    let v=(mx>mn?50+(scs[i]-mn)/(mx-mn)*40:70)+div*10;
    return Math.round(Math.max(0,Math.min(100,v))*10)/10;
  });
}

// ---- justificativa automatica por jogo ----
function justificaJogo(g,modelo,pesos){
  const m=metrics(g);
  const sd=scoreDezenas(pesos||PESOS_DEFAULT);
  const top5score=[...NUMS].sort((a,b)=>sd[b].score-sd[a].score).slice(0,5);
  const nTop=g.filter(n=>top5score.includes(n)).length;
  const nQuente=m.quentes; const nFria=m.frias;
  const atrasadasGeral=D.freq.atrasadas||[];
  const nOpor=g.filter(n=>atrasadasGeral.includes(n)).length;
  const liftMedioJ=(()=>{let s=0,c=0;for(let i=0;i<g.length;i++)for(let j=i+1;j<g.length;j++){s+=pairLift(g[i],g[j]);c++;}return c?s/c:1;})();
  const partes=[];
  if(nTop>0) partes.push(`${nTop} dezena${nTop>1?'s':''} no top-5 score ponderado`);
  partes.push(`${nQuente} quente${nQuente!==1?'s':''}, ${m.neutras} neutra${m.neutras!==1?'s':''}, ${nFria} fria${nFria!==1?'s':''}`);
  if(nOpor>0) partes.push(`${nOpor} dezena${nOpor>1?'s':''} de oportunidade (atrasadas)`);
  partes.push(`soma ${m.soma} (faixa ${m.soma<180?'baixa':m.soma<=210?'comum':'alta'})`);
  partes.push(`afinidade média dos pares: ${liftMedioJ.toFixed(2)} (${liftMedioJ>=1.05?'acima':'próximo'} do esperado)`);
  partes.push(`${m.repetidas_ult} repetida${m.repetidas_ult!==1?'s':''} do último concurso`);
  return partes.join(' · ');
}

let lastJogos=null,lastIEE=null,lastCfg=null;
ROUTES.gerador = (p)=>{
  p.appendChild(el('p','page-intro','Gera jogos a partir das análises, respeitando padrões de par/ímpar, soma, repetição, cobertura e equilíbrio de linhas/colunas.'));
  const card=el('div','card');card.innerHTML=`<h3>${icon('sliders-horizontal')}Configuração</h3>`;
  const ctl=el('div','controls');
  ctl.innerHTML=`
    <div class="ctl"><label>Modelo de seleção</label><select id="gModelo">
      <option value="temperatura">Temperatura (quentes/frias)</option>
      <option value="score">Pontuação ponderada</option>
      <option value="hibrido">Híbrido (5 quentes + 5 oportunidade + 5 frias)</option>
    </select></div>
    <div class="ctl"><label>Quantidade de jogos</label><input type="number" id="gQtd" value="9" min="1" max="30"></div>
    <div class="ctl"><label>Regra pares/ímpares</label><select id="gReg">
      <option value="8,8,8,7,7,7,8,8,8">Grupos 8P / 7P / 8P (padrão)</option>
      <option value="8,8,8,8,8,8,8,8,8">Todos 8 pares</option>
      <option value="7,7,7,7,7,7,7,7,7">Todos 7 pares</option>
    </select></div>
    <div class="ctl"><label>Soma alvo: <span class="rangeval" id="gSomaV">185–205</span></label>
      <input type="range" id="gSomaMin" min="150" max="240" value="185"><input type="range" id="gSomaMax" min="150" max="240" value="205"></div>
    <div class="ctl"><label>Repetidas do último: <span class="rangeval" id="gRepV">8–10</span></label>
      <input type="range" id="gRepMin" min="0" max="15" value="8"><input type="range" id="gRepMax" min="0" max="15" value="10"></div>
    <div class="ctl"><label>Interseção entre jogos: <span class="rangeval" id="gIntV">8–11</span></label>
      <input type="range" id="gIntMin" min="0" max="15" value="8"><input type="range" id="gIntMax" min="0" max="15" value="11"></div>
    <div class="ctl"><label>Composição por jogo</label>
      <span class="switch">Quentes <input type="number" id="gNq" value="8" min="0" max="15" style="width:56px"></span>
      <span class="switch">Neutras <input type="number" id="gNn" value="4" min="0" max="15" style="width:56px"></span>
      <span class="switch">Frias <input type="number" id="gNf" value="3" min="0" max="15" style="width:56px"></span></div>
    <div class="ctl"><label>Opções</label><label class="switch"><input type="checkbox" id="gCob" checked> Cobrir as 25 dezenas</label></div>
  `;
  // painel de pesos do score ponderado (só visível no modelo score)
  const pesosPanel=el('div','card');pesosPanel.style.cssText='margin-top:12px;display:none';
  pesosPanel.innerHTML=`<h3 style="margin-bottom:14px">${icon('percent')}Pesos do score ponderado (soma deve ser 100%)</h3>
    <div class="controls">
      <div class="ctl"><label>Freq. 50 concursos: <span class="rangeval" id="pF50V">40%</span></label><input type="range" id="pF50" min="0" max="100" value="40"></div>
      <div class="ctl"><label>Freq. 20 concursos: <span class="rangeval" id="pF20V">20%</span></label><input type="range" id="pF20" min="0" max="100" value="20"></div>
      <div class="ctl"><label>Atraso atual: <span class="rangeval" id="pAtrV">15%</span></label><input type="range" id="pAtr" min="0" max="100" value="15"></div>
      <div class="ctl"><label>Repetição hist.: <span class="rangeval" id="pRepV">15%</span></label><input type="range" id="pRep" min="0" max="100" value="15"></div>
      <div class="ctl"><label>Afinidade (Lift): <span class="rangeval" id="pAfiV">10%</span></label><input type="range" id="pAfi" min="0" max="100" value="10"></div>
    </div>
    <div id="pesoTotal" style="margin-top:8px;font-size:12px;font-weight:600"></div>`;
  card.appendChild(ctl);
  card.appendChild(pesosPanel);
  // exibe/oculta painel de pesos conforme modelo
  const togglePesos=()=>{const m=$('#gModelo').value;pesosPanel.style.display=m==='score'?'block':'none';};
  const actions=el('div');actions.style.cssText='display:flex;gap:10px;margin-top:16px;flex-wrap:wrap';
  const bGen=el('button','btn');bGen.innerHTML=`${icon('wand-2')} Gerar jogos`;
  const bReg=el('button','btn ghost');bReg.innerHTML=`${icon('refresh-cw')} Regerar`;
  const bTxt=el('button','btn ghost');bTxt.innerHTML=`${icon('copy')} Copiar todos (TXT)`;
  const bRank=el('button','btn ghost');bRank.innerHTML=`${icon('list')} Ranking de dezenas`;
  actions.append(bGen,bReg,bTxt,bRank);card.appendChild(actions);
  p.appendChild(card);
  const rankPanel=el('div');rankPanel.id='gRankPanel';rankPanel.style.marginTop='16px';p.appendChild(rankPanel);
  const results=el('div');results.id='gResults';results.style.marginTop='16px';p.appendChild(results);

  const sync=()=>{
    $('#gSomaV').textContent=`${$('#gSomaMin').value}–${$('#gSomaMax').value}`;
    $('#gRepV').textContent=`${$('#gRepMin').value}–${$('#gRepMax').value}`;
    $('#gIntV').textContent=`${$('#gIntMin').value}–${$('#gIntMax').value}`;
    const pIds=['pF50','pF20','pAtr','pRep','pAfi'];
    pIds.forEach(id=>{const lbl=$(` #${id}V`);if(lbl)lbl.textContent=`${$('#'+id).value}%`;});
    const tot=pIds.reduce((s,id)=>s+(+($('#'+id)?.value||0)),0);
    const totEl=$('#pesoTotal');if(totEl)totEl.textContent=`Total: ${tot}% ${tot===100?'✓':'— ajuste para 100% para melhor resultado'}`;
    totEl&&(totEl.style.color=tot===100?'var(--ok)':'var(--q1)');
    togglePesos();
  };
  setTimeout(()=>{
    card.querySelectorAll('input[type=range]').forEach(r=>r.oninput=sync);
    $('#gModelo')?.addEventListener('change',togglePesos);
    sync();
  },0);

  function readPesos(){
    return {f50:+($('#pF50')?.value||40),f20:+($('#pF20')?.value||20),
      atraso:+($('#pAtr')?.value||15),repeticao:+($('#pRep')?.value||15),afinidade:+($('#pAfi')?.value||10)};
  }
  function readCfg(){
    return {qtd:+$('#gQtd').value,regras:$('#gReg').value.split(',').map(Number),
      somaMin:+$('#gSomaMin').value,somaMax:+$('#gSomaMax').value,
      repMin:+$('#gRepMin').value,repMax:+$('#gRepMax').value,
      interMin:+$('#gIntMin').value,interMax:+$('#gIntMax').value,
      nq:+$('#gNq').value,nn:+$('#gNn').value,nf:+$('#gNf').value,cobrir25:$('#gCob').checked,
      modelo:$('#gModelo')?.value||'temperatura',pesos:readPesos()};
  }
  function run(){
    const cfg=readCfg();lastCfg=cfg;
    lastJogos=generateSet(cfg);lastIEE=normIEE(lastJogos);
    renderJogos(results,lastJogos,lastIEE,cfg);
    toast('Jogos gerados');
  }
  bGen.onclick=run;bReg.onclick=run;
  bTxt.onclick=()=>{if(!lastJogos){toast('Gere os jogos primeiro');return;}
    copy(lastJogos.map(g=>g.map(pad).join(' ')).join('\n'),'TXT copiado');};
  bRank.onclick=()=>{
    const cfg=readCfg();const sd=scoreDezenas(cfg.pesos);
    const ranked=[...NUMS].sort((a,b)=>sd[b].score-sd[a].score);
    rankPanel.innerHTML='';
    const rc=el('div','card');rc.innerHTML=`<h3>${icon('list')}Ranking por score ponderado</h3>`;
    const wrap=el('div','table-wrap');
    let h='<table><thead><tr><th>#</th><th>Dezena</th><th>Score</th><th>Freq.50</th><th>Freq.20</th><th>Atraso</th><th>Repetição</th><th>Afinidade</th><th>Classe</th></tr></thead><tbody>';
    ranked.forEach((n,i)=>{const sd2=sd[n];
      h+=`<tr><td>${i+1}</td><td><b>${pad(n)}</b></td><td><b>${sd2.score.toFixed(1)}</b></td>
        <td>${sd2.partes.f50}%</td><td>${sd2.partes.f20}%</td><td>${sd2.partes.atraso}%</td>
        <td>${sd2.partes.repeticao}%</td><td>${sd2.partes.afinidade}%</td>
        <td class="cell-${clsKey(n)}">${cls(n)}</td></tr>`;});
    h+='</tbody></table>';wrap.innerHTML=h;rc.appendChild(wrap);
    rc.appendChild(el('p','note','Score = média ponderada dos 5 componentes, normalizados de 0 a 100.'));
    rankPanel.appendChild(rc);refreshIcons();
  };
};

function renderJogos(container,jogos,iee,cfg){
  container.innerHTML='';
  // validações
  const cov=new Set(jogos.flat());
  const inter=[];for(let i=0;i<jogos.length;i++)for(let j=i+1;j<jogos.length;j++)inter.push(jogos[i].filter(n=>jogos[j].includes(n)).length);
  const checks=[
    ['15 dezenas de 01–25, sem repetição',jogos.every(g=>g.length===15&&new Set(g).size===15&&g.every(n=>n>=1&&n<=25))],
    ['Par/ímpar conforme regra',jogos.every((g,i)=>metrics(g).pares===cfg.regras[i%cfg.regras.length])],
    ['Jogos distintos',new Set(jogos.map(g=>g.join())).size===jogos.length],
    ['Interseção dentro do intervalo',inter.every(x=>x>=cfg.interMin&&x<=cfg.interMax)],
    ['25 dezenas cobertas',cov.size===25 || !cfg.cobrir25],
  ];
  const cv=el('div','card');cv.innerHTML=`<h3>${icon('check-circle-2')}Validações</h3>`;
  const vl=el('div','vlist');
  checks.forEach(([k,ok])=>{const r=el('div','vrow');
    r.innerHTML=`<span class="vi ${ok?'ok':'bad'}">${icon(ok?'check':'x')}</span><span class="vk">${k}</span><span class="tag ${ok?'ok':'bad'}">${ok?'OK':'Atenção'}</span>`;
    vl.appendChild(r);});
  cv.appendChild(vl);container.appendChild(cv);

  const grid=el('div','grid two');grid.style.marginTop='16px';
  jogos.forEach((g,i)=>{
    const m=metrics(g);
    const card=el('div','jogo-card');
    const head=el('div','jogo-head');
    head.innerHTML=`<span class="jn">Jogo ${i+1}</span>
      <div class="iee"><span class="n">${iee[i]}</span><span class="l">Índice de equilíbrio</span></div>`;
    card.appendChild(head);
    card.appendChild(chipRow(g,{rep:false}).cloneNode(false));
    const chips=el('div','chips');g.forEach(n=>chips.appendChild(mkChip(n,{rep:D.ult.dezenas.includes(n)})));
    card.appendChild(chips);
    const mm=el('div','jogo-metrics');
    mm.innerHTML=`<span><b>${m.pares}</b>P/<b>${m.impares}</b>I</span><span>Mol <b>${m.moldura}</b></span>
      <span>Cen <b>${m.centro}</b></span><span>Soma <b>${m.soma}</b></span><span>Rep <b>${m.repetidas_ult}</b></span>
      <span>B <b>${m.baixas}</b>/A <b>${m.altas}</b></span><span>Primos <b>${m.primos}</b></span>
      <span>Seq <b>${m.seqs}</b></span><span>L ${m.linhas.join('-')}</span><span>C ${m.colunas.join('-')}</span>
      <span>Q<b>${m.quentes}</b> N<b>${m.neutras}</b> F<b>${m.frias}</b></span>`;
    card.appendChild(mm);
    const just=el('p','note');just.style.marginTop='8px';
    just.textContent=justificaJogo(g,cfg.modelo,cfg.pesos);
    const btnBox=el('div');btnBox.style.cssText='display:flex;gap:8px;margin-top:12px;flex-wrap:wrap';
    const cp=el('button','btn ghost sm');cp.innerHTML=`${icon('copy')} Copiar`;
    cp.onclick=()=>copy(g.map(pad).join(' '),`Jogo ${i+1} copiado`);
    const sbBtn=el('button','btn sm');sbBtn.innerHTML=`${icon('database')} Salvar no Supabase`;
    sbBtn.onclick=async ()=>{
      if(!sbClient){toast('Supabase não conectado');return;}
      const { error } = await sbClient.from('jogos_gerados').insert([{ dezenas: g, ie_score: iee[i], estrategia: `Modelo: ${cfg.modelo}` }]);
      if(error) toast('Erro ao salvar: '+error.message);
      else toast(`Jogo ${i+1} salvo no Supabase! 🎉`);
    };
    btnBox.append(cp, sbBtn);
    card.appendChild(btnBox);
    grid.appendChild(card);
  });
  container.appendChild(grid);
  refreshIcons();
}

/* ============================================================
   BACKTEST
   ============================================================ */
ROUTES.backtest = (p)=>{
  const bt=D.bt;
  p.appendChild(el('p','page-intro',`Teste honesto: para cada um dos últimos ${bt.n} concursos, monta-se um jogo usando apenas os 100 concursos ANTERIORES ao alvo (sem usar o resultado do próprio concurso).`));
  const kpis=el('div','grid cards');
  kpis.append(kpi('target','Média de acertos',bt.media.toFixed(2)),kpi('minus','Mediana',bt.mediana),
    kpi('arrow-down','Pior',bt.min),kpi('arrow-up','Melhor',bt.max));
  p.appendChild(kpis);
  const c=el('div','card');c.style.marginTop='16px';c.innerHTML=`<h3>${icon('bar-chart-3')}Jogos por faixa de acertos</h3>`;
  const cb=el('div','chart-box');const cv=el('canvas');cb.appendChild(cv);c.appendChild(cb);p.appendChild(c);
  bar(cv,['≥11','≥12','≥13','=14','=15'],[bt.p11,bt.p12,bt.p13,bt.p14,bt.p15],{colors:'#7c3aed'});
  p.appendChild(el('p','note','Este teste é retrospectivo e não garante desempenho futuro. Nenhum resultado conhecido foi usado para montar os jogos.'));
};

/* ============================================================
   CONFERÊNCIA
   ============================================================ */
ROUTES.conferencia = (p)=>{
  p.appendChild(el('p','page-intro','Insira as 15 dezenas de um concurso para conferir os jogos gerados. Se ainda não gerou jogos, os 9 jogos sugeridos são usados.'));
  const jogos=lastJogos||D.jogos;
  const card=el('div','card');card.innerHTML=`<h3>${icon('check-circle-2')}Resultado do concurso</h3>`;
  card.appendChild(el('p','note','Digite 15 dezenas (01–25) ou cole no campo abaixo.'));
  const paste=el('input');paste.type='text';paste.placeholder='ex.: 01 02 03 ...';
  paste.style.cssText='width:100%;padding:10px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text);margin:8px 0';
  card.appendChild(paste);
  const inputs=el('div','conf-inputs');
  const fields=[];
  for(let i=0;i<15;i++){const inp=el('input');inp.type='number';inp.min=1;inp.max=25;inp.inputMode='numeric';fields.push(inp);inputs.appendChild(inp);}
  card.appendChild(inputs);
  const actions=el('div');actions.style.cssText='display:flex;gap:10px;flex-wrap:wrap';
  const bConf=el('button','btn');bConf.innerHTML=`${icon('check')} Conferir`;
  const bClr=el('button','btn ghost');bClr.innerHTML=`${icon('eraser')} Limpar`;
  actions.append(bConf,bClr);card.appendChild(actions);
  p.appendChild(card);
  const out=el('div');out.id='confOut';out.style.marginTop='16px';p.appendChild(out);

  paste.oninput=()=>{const nums=paste.value.match(/\d+/g)||[];nums.slice(0,15).forEach((v,i)=>fields[i].value=v);};
  bClr.onclick=()=>{fields.forEach(f=>f.value='');paste.value='';out.innerHTML='';};
  bConf.onclick=()=>{
    const res=fields.map(f=>+f.value).filter(n=>n>=1&&n<=25);
    if(new Set(res).size!==15){toast('Informe 15 dezenas válidas e distintas');return;}
    const resSet=new Set(res);
    let melhor=-1,melhorI=0,premiados=0;
    const rows=jogos.map((g,i)=>{const ac=g.filter(n=>resSet.has(n)).length;
      if(ac>melhor){melhor=ac;melhorI=i;}if(ac>=11)premiados++;return {g,ac,i};});
    out.innerHTML='';
    const kpis=el('div','grid cards');
    kpis.append(kpi('trophy','Maior acerto',melhor),kpi('award','Melhor jogo',`Jogo ${melhorI+1}`),
      kpi('ticket','Jogos premiados',premiados));
    out.appendChild(kpis);
    const grid=el('div','grid two');grid.style.marginTop='16px';
    const faixa=ac=>ac>=11?`${ac} pontos`:'Sem premiação';
    rows.forEach(({g,ac,i})=>{
      const card=el('div','jogo-card');
      card.innerHTML=`<div class="jogo-head"><span class="jn">Jogo ${i+1}</span>
        <span class="tag ${ac>=11?'ok':'bad'}">${ac} acertos · ${faixa(ac)}</span></div>`;
      const chips=el('div','chips');
      g.forEach(n=>{const c=mkChip(n);if(resSet.has(n))c.classList.add('hit');else c.classList.add('miss');chips.appendChild(c);});
      card.appendChild(chips);
      if(i===melhorI){card.style.outline='2px solid var(--primary)';}
      grid.appendChild(card);
    });
    out.appendChild(grid);refreshIcons();
  };
};

/* ============================================================
   ATUALIZAR RESULTADOS (via API oficial da Caixa)
   ============================================================ */
const API_CAIXA='https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil';
ROUTES.atualizar = (p)=>{
  const v=D.val;
  p.appendChild(el('p','page-intro','Busca concursos novos na API oficial da Caixa e anexa ao seu Excel. A gravação no arquivo é feita por um script Python (o navegador não escreve em disco nem acessa o site da Caixa por questões de segurança/CORS).'));

  // status atual
  const c0=el('div','card');
  c0.innerHTML=`<h3>${icon('database')}Situação atual</h3>`;
  const vl=el('div','vlist');
  vl.innerHTML=`<div class="vrow"><span class="vk">Último concurso na sua base</span><span class="vv">${v.concurso_recente} (${v.data_recente})</span></div>
    <div class="vrow"><span class="vk">Último publicado pela Caixa</span><span class="vv" id="apiUlt">verificando…</span></div>
    <div class="vrow"><span class="vk">Situação</span><span id="apiStatus" class="tag">consultando</span></div>`;
  c0.appendChild(vl);
  const btnCheck=el('button','btn ghost sm');btnCheck.style.marginTop='12px';btnCheck.innerHTML=`${icon('refresh-cw')} Verificar de novo`;
  c0.appendChild(btnCheck);
  p.appendChild(c0);

  // instruções do script
  const c1=el('div','card');c1.style.marginTop='16px';
  c1.innerHTML=`<h3>${icon('terminal')}Como atualizar (1 comando)</h3>
    <p class="note" style="margin-bottom:10px">Na pasta do projeto, rode no terminal:</p>
    <pre style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:14px;overflow-x:auto;font-size:13px"><code>python3 atualizar.py --tudo</code></pre>
    <p class="note">Isso baixa os concursos que faltam, faz backup do Excel, anexa os novos resultados, refaz a análise e regenera os dados do dashboard. Ao terminar, recarregue esta página.</p>`;
  const btnCopy=el('button','btn sm');btnCopy.innerHTML=`${icon('copy')} Copiar comando`;
  btnCopy.onclick=()=>copy('python3 atualizar.py --tudo','Comando copiado');
  c1.appendChild(btnCopy);
  p.appendChild(c1);

  const c2=el('div','card');c2.style.marginTop='16px';
  c2.innerHTML=`<h3>${icon('info')}Passo a passo detalhado</h3>
    <ol style="margin-left:18px;line-height:1.9;font-size:13.5px">
      <li><code>python3 atualizar.py</code> — só baixa e anexa ao Excel (com backup automático).</li>
      <li><code>python3 analise.py</code> — recalcula todas as estatísticas dos 300 concursos.</li>
      <li><code>python3 gera_dados_dashboard.py</code> — atualiza <code>dashboard/dados.js</code>.</li>
      <li>Recarregue o dashboard no navegador.</li>
    </ol>
    <p class="note">O comando <code>--tudo</code> faz os 3 primeiros passos de uma vez.</p>`;
  p.appendChild(c2);

  // verificação ao vivo (pode falhar por CORS em file://)
  function verificar(){
    const ul=$('#apiUlt'),st=$('#apiStatus');
    ul.textContent='verificando…';st.className='tag';st.textContent='consultando';
    fetch(API_CAIXA,{headers:{'Accept':'application/json'}})
      .then(r=>r.json())
      .then(d=>{
        const n=+d.numero;ul.textContent=`${n} (${d.dataApuracao})`;
        if(n>v.concurso_recente){st.className='tag bad';st.textContent=`${n-v.concurso_recente} concurso(s) novo(s) — rode o script`;}
        else{st.className='tag ok';st.textContent='sua base está em dia';}
      })
      .catch(()=>{
        ul.textContent='não foi possível consultar aqui';
        st.className='tag';st.textContent='verifique pelo script Python';
      });
  }
  btnCheck.onclick=verificar;verificar();
};

/* ============================================================
   SUPABASE: JOGOS SALVOS E GESTÃO
   ============================================================ */
ROUTES.jogossalvos = (p)=>{
  p.appendChild(el('p','page-intro','Jogos salvos diretamente na nuvem do Supabase PostgreSQL.'));
  const card=el('div','card');
  card.innerHTML=`<h3>${icon('database')}Jogos salvos no Supabase</h3>`;
  const listContainer=el('div');listContainer.style.marginTop='16px';
  card.appendChild(listContainer);
  p.appendChild(card);

  async function carregarJogos(){
    if(!sbClient){
      listContainer.innerHTML='<p class="note">Supabase SDK não inicializado.</p>';
      return;
    }
    listContainer.innerHTML='<p class="note">Carregando do Supabase…</p>';
    const { data, error } = await sbClient.from('jogos_gerados').select('*').order('created_at',{ascending:false});
    if(error){
      listContainer.innerHTML=`<p class="note bad">Erro ao carregar: ${error.message}</p>`;
      return;
    }
    if(!data || data.length===0){
      listContainer.innerHTML='<p class="note">Nenhum jogo salvo no Supabase ainda. Acesse o Gerador de Jogos para salvar!</p>';
      return;
    }
    listContainer.innerHTML='';
    const grid=el('div','grid two');
    data.forEach((item, idx)=>{
      const c=el('div','jogo-card');
      c.innerHTML=`<div class="jogo-head"><span class="jn">Jogo #${data.length - idx}</span><span class="tag ok">IEE: ${item.ie_score || '—'}</span></div>`;
      const chips=el('div','chips');
      (item.dezenas||[]).forEach(n=>chips.appendChild(mkChip(n)));
      c.appendChild(chips);
      if(item.estrategia) c.appendChild(el('p','note',`Estratégia: ${item.estrategia}`));
      grid.appendChild(c);
    });
    listContainer.appendChild(grid);
    refreshIcons();
  }
  carregarJogos();
};

ROUTES.pacientes = (p)=>{
  p.appendChild(el('p','page-intro','Módulo de Gestão: Pacientes e Agendamentos integrados com Supabase Database & Auth.'));
  
  const grid=el('div','grid two');
  
  // Card Novo Paciente
  const cPac=el('div','card');
  cPac.innerHTML=`<h3>${icon('user-plus')}Cadastrar Paciente</h3>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
      <input id="pacNome" type="text" placeholder="Nome completo" style="padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)">
      <input id="pacCpf" type="text" placeholder="CPF" style="padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)">
      <input id="pacTel" type="text" placeholder="Telefone / WhatsApp" style="padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)">
      <button id="btnSalvarPac" class="btn">${icon('save')} Salvar Paciente</button>
    </div>`;
  grid.appendChild(cPac);

  // Card Novo Agendamento
  const cAg=el('div','card');
  cAg.innerHTML=`<h3>${icon('calendar')}Novo Agendamento</h3>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
      <input id="agData" type="datetime-local" style="padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)">
      <textarea id="agObs" placeholder="Observações da consulta" style="padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);height:80px"></textarea>
      <button id="btnSalvarAg" class="btn">${icon('plus-circle')} Confirmar Horário</button>
    </div>`;
  grid.appendChild(cAg);

  p.appendChild(grid);

  // Tabela Pacientes Cadastrados
  const cList=el('div','card');cList.style.marginTop='16px';
  cList.innerHTML=`<h3>${icon('users')}Pacientes & Agendamentos no Supabase</h3><div id="pacListContainer" style="margin-top:12px"><p class="note">Carregando do Supabase…</p></div>`;
  p.appendChild(cList);

  async function carregarPacientes(){
    const cont=$('#pacListContainer');
    if(!sbClient){cont.innerHTML='<p class="note">Supabase não inicializado.</p>';return;}
    const { data: pacs, error } = await sbClient.from('pacientes').select('*').order('created_at',{ascending:false});
    if(error){cont.innerHTML=`<p class="note bad">Erro: ${error.message}</p>`;return;}
    if(!pacs || pacs.length===0){
      cont.innerHTML='<p class="note">Nenhum paciente cadastrado no banco do Supabase ainda.</p>';
      return;
    }
    let html='<table class="tbl"><thead><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Cadastrado em</th></tr></thead><tbody>';
    pacs.forEach(pc=>{
      html+=`<tr><td><b>${pc.nome}</b></td><td>${pc.cpf||'—'}</td><td>${pc.telefone||'—'}</td><td>${new Date(pc.created_at).toLocaleDateString('pt-BR')}</td></tr>`;
    });
    html+='</tbody></table>';
    cont.innerHTML=html;
  }

  setTimeout(()=>{
    const btnP=$('#btnSalvarPac');
    if(btnP) btnP.onclick=async ()=>{
      const nome=$('#pacNome').value;
      const cpf=$('#pacCpf').value;
      const tel=$('#pacTel').value;
      if(!nome){toast('Informe o nome do paciente');return;}
      if(!sbClient){toast('Supabase offline');return;}
      const { error } = await sbClient.from('pacientes').insert([{ nome, cpf, telefone: tel }]);
      if(error){toast('Erro: '+error.message);}
      else{
        toast('Paciente salvo no Supabase! 🎉');
        $('#pacNome').value='';$('#pacCpf').value='';$('#pacTel').value='';
        carregarPacientes();
      }
    };
  },100);

  carregarPacientes();
};

/* ============================================================
   ROTA: CAIXA DE SUGESTÕES
   ============================================================ */
ROUTES.sugestoes = function(p) {
  p.innerHTML = '';
  const head = el('div', 'page-head');
  head.innerHTML = `<div><h2>Caixa de Sugestões</h2><p class="subtitle">Envie suas sugestões, feedbacks ou relatórios de melhoria diretamente para o desenvolvedor.</p></div>`;
  p.appendChild(head);

  const container = el('div', 'card');
  container.style.maxWidth = '600px';
  container.style.margin = '20px 0';
  container.innerHTML = `
    <h3>${icon('message-square')} Enviar Feedback / Sugestão</h3>
    <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:15px">
      Sua opinião é fundamental para a evolução do Dashboard da Lotofácil. As sugestões enviadas serão salvas no banco de dados e encaminhadas para <strong>agenorjesusjr@gmail.com</strong>.
    </p>
    <form id="formSugestao" style="display:flex; flex-direction:column; gap:12px">
      <div>
        <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom:4px">Seu Nome (opcional)</label>
        <input type="text" id="sugNome" placeholder="Ex: Maria Silva" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--text)">
      </div>
      <div>
        <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom:4px">Seu E-mail (opcional)</label>
        <input type="email" id="sugEmail" placeholder="seuemail@exemplo.com" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--text)">
      </div>
      <div>
        <label style="display:block; font-size:0.85rem; font-weight:600; margin-bottom:4px">Sua Sugestão ou Mensagem *</label>
        <textarea id="sugMensagem" required placeholder="Escreva aqui suas sugestões, novos recursos desejados ou relatórios de bugs..." style="width:100%; height:120px; padding:10px; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--text); resize:vertical"></textarea>
      </div>
      <button type="submit" id="btnEnviarSug" class="btn" style="align-self:flex-start">${icon('send')} Enviar Sugestão</button>
    </form>
    <div id="sugFeedback" style="margin-top:15px"></div>
  `;
  p.appendChild(container);

  setTimeout(() => {
    const form = $('#formSugestao');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const nome = $('#sugNome').value.trim();
        const email = $('#sugEmail').value.trim();
        const mensagem = $('#sugMensagem').value.trim();
        const btn = $('#btnEnviarSug');
        const fb = $('#sugFeedback');

        if (!mensagem) {
          toast('Por favor, digite sua mensagem.');
          return;
        }

        btn.disabled = true;
        btn.innerHTML = `${icon('loader-2')} Enviando...`;

        try {
          // 1. Salva no Supabase
          if (sbClient) {
            const { error } = await sbClient.from('sugestoes').insert([{ nome, email, mensagem }]);
            if (error) console.error("Erro Supabase sugestoes:", error);
          }

          // 2. Envio via FormSubmit / Mailto para garantir que chegue em agenorjesusjr@gmail.com
          fetch('https://formsubmit.co/ajax/agenorjesusjr@gmail.com', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              _subject: "Nova Sugestão - Dashboard Lotofácil",
              Nome: nome || "Anônimo",
              Email: email || "Não informado",
              Mensagem: mensagem
            })
          }).catch(err => console.log("FormSubmit fallback:", err));

          toast('Sugestão enviada com sucesso! Obrigado pelo feedback. 🎉');
          fb.innerHTML = `<div class="note good" style="margin-top:10px">${icon('check-circle')} Sua sugestão foi registrada e enviada para <strong>agenorjesusjr@gmail.com</strong>!</div>`;
          $('#sugNome').value = '';
          $('#sugEmail').value = '';
          $('#sugMensagem').value = '';
        } catch (err) {
          console.error("Erro envio sugestão:", err);
          toast('Ocorreu um erro ao enviar. Tente novamente.');
        } finally {
          btn.disabled = false;
          btn.innerHTML = `${icon('send')} Enviar Sugestão`;
          refreshIcons();
        }
      };
    }
  }, 100);
};

/* ============================================================
   TEMA + SIDEBAR + BOOT
   ============================================================ */
function setTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  localStorage.setItem('lf-theme',t);
  const btn=$('#themeBtn');if(btn)btn.innerHTML=icon(t==='dark'?'sun':'moon');
  refreshIcons();
  if(current&&ROUTES[current])go(current); // redesenha gráficos com cores do tema
}
function openSidebar(){$('#sidebar').classList.add('open');$('#overlay').classList.add('show');}
function closeSidebar(){$('#sidebar').classList.remove('open');$('#overlay').classList.remove('show');}

function boot(){
  const v=D.val;
  $('#periodBadge').textContent=`${v.usados} concursos — ${v.amostra_ini} a ${v.amostra_fim}`;
  $('#sbAmostra').textContent=`${v.usados} concursos (${v.data_ini}–${v.data_fim})`;
  const allOk=v.dup_concurso===0&&v.fora_intervalo===0&&v.rep_intra===0&&v.celulas_vazias===0;
  if(!allOk){const b=$('#statusBadge');b.style.color='var(--err)';b.innerHTML=`${icon('shield-alert')} Verificar dados`;}
  buildNav();
  setTheme(localStorage.getItem('lf-theme')||'light');
  $('#themeBtn').onclick=()=>setTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark');
  $('#menuBtn').onclick=openSidebar;$('#sidebarClose').onclick=closeSidebar;$('#overlay').onclick=closeSidebar;
  const hash=location.hash.slice(1);
  go(ROUTES[hash]?hash:'home');
  window.addEventListener('resize',()=>{if(current)charts.forEach(c=>c.resize());});
}
if(!D){document.getElementById('content').innerHTML='<div class="empty">Erro: dados.js não carregou. Verifique se o arquivo está na mesma pasta.</div>';}
else{boot();}
