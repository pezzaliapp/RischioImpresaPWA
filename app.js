// Utility
const € = n => isFinite(n) ? n.toLocaleString('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}) : '—';
const €2 = n => isFinite(n) ? n.toLocaleString('it-IT',{style:'currency',currency:'EUR'}) : '—';
const pct = n => isFinite(n) ? (n*100).toFixed(1)+'%' : '—';
const num = n => isFinite(n) ? n.toLocaleString('it-IT') : '—';

// Elements
const el = id => document.getElementById(id);
const ids = ['p','cv','cf','q','debt','rate','equity'];
const vals = () => Object.fromEntries(ids.map(k => [k, Number(el(k).value)||0]));

// Score model (0-100, 100 = basso rischio)
function riskScore({p,cv,cf,q,debt,rate,equity}){
  const mc_u = p - cv;
  const rev = p*q;
  const varCost = cv*q;
  const ebit = rev - varCost - cf;
  const interest = debt*(rate/100);
  const icr = interest>0 ? ebit/interest : (ebit>0?10: (ebit<0? -10: 0)); // cap later
  const bep_u = mc_u>0 ? (cf/mc_u) : Infinity;
  const safety = (q>0 && isFinite(bep_u)) ? (q - bep_u)/q : -1; // -inf..1

  const mcp = p>0 ? mc_u/p : 0;
  const dol = (ebit!==0) ? ((rev-varCost)/Math.max(ebit, -1e6)) : 99;

  // Normalize components to 0..100
  let s1 = Math.max(0, Math.min(100, (safety*100)));
  s1 = s1/0.8; if(s1>100) s1=100;

  let s2 = Math.max(0, Math.min(100, (mcp*100)));
  s2 = (s2/40)*100; if(s2>100) s2=100;

  let s3 = Math.max(0, Math.min(100, (icr>=0? Math.min(icr,4)/2*100 : 0)));
  if (s3>100) s3=100;

  let s4 = Math.max(0, Math.min(100, 100 - Math.min(Math.abs(dol),10)/10*100));

  const score = Math.round(0.35*s1 + 0.25*s2 + 0.25*s3 + 0.15*s4);
  return { score, mc_u, mcp, bep_u, rev, varCost, ebit, interest, icr, dol, safety };
}

function render(){
  const v = vals();
  const r = riskScore(v);

  el('mc_u').textContent = €2(r.mc_u);
  el('mc_pct').textContent = pct(r.mcp);
  el('bep_u').textContent = isFinite(r.bep_u) ? num(Math.ceil(r.bep_u)) : '—';
  el('bep_rev').textContent = isFinite(r.bep_u) ? €2(Math.ceil(r.bep_u)*v.p) : '—';
  el('rev').textContent = €2(r.rev);
  el('ebit').textContent = €2(r.ebit);
  el('int').textContent = €2(r.interest);
  el('icr').textContent = isFinite(r.icr) ? r.icr.toFixed(2) : '—';
  el('dol').textContent = isFinite(r.dol) ? (Math.abs(r.dol)>50? '›50' : r.dol.toFixed(2)) : '—';

  const badge = el('scoreBadge');
  badge.textContent = `Score: ${r.score}/100`;
  const bar = el('scoreBar').firstElementChild;
  bar.style.width = `${r.score}%`;

  let note = '';
  if (r.score < 40) { badge.style.background = '#ffe3e3'; note = 'Rischio ALTO: agisci subito.'; }
  else if (r.score < 70) { badge.style.background = '#fff3d4'; note = 'Rischio MEDIO: migliora i fondamentali.'; }
  else { badge.style.background = '#e2ffe8'; note = 'Rischio BASSO: continua così ma monitora.'; }
  el('scoreNote').textContent = note;
}

function plan(){
  const v = vals();
  const r = riskScore(v);

  if (!isFinite(r.bep_u) || r.mc_u<=0){
    return `<p>Il prezzo è ≤ ai costi variabili. Aumenta il <strong>prezzo</strong> o riduci i <strong>costi variabili</strong> per creare margine di contribuzione.</p>`;
  }

  const targetSafety = 0.20;
  const targetICR = 2.0;

  const bep = r.bep_u;
  const qTarget = Math.max(v.q, Math.ceil(bep / (1 - targetSafety)));
  const addUnits = Math.max(0, qTarget - v.q);

  const mc_needed = v.cf / (v.q*(1-targetSafety));
  const pTarget = mc_needed + v.cv;
  const dPrice = Math.max(0, pTarget - v.p);

  const cfTarget = (v.p - v.cv) * v.q * (1 - targetSafety);
  const cutCF = Math.max(0, v.cf - cfTarget);

  const interest = v.debt*(v.rate/100);
  const needEBITforICR = interest*targetICR;
  const deltaEBIT_ICR = Math.max(0, needEBITforICR - r.ebit);
  const unitsForICR = r.mc_u>0 ? Math.ceil(deltaEBIT_ICR / r.mc_u) : Infinity;

  const fmt = n => isFinite(n) ? n.toLocaleString('it-IT') : '—';

  return `
    <ul>
      <li><strong>Aumenta volumi</strong>: +<b>${fmt(addUnits)}</b> unità/anno (safety ≥ 20%).</li>
      <li><strong>Aggiusta prezzo</strong>: +<b>${€2(dPrice)}</b> per unità (a parità di Q).</li>
      <li><strong>Taglia costi fissi</strong>: −<b>${€2(cutCF)}</b> (a prezzi e volumi attuali).</li>
      <li><strong>Copri oneri</strong>: +<b>${fmt(unitsForICR)}</b> unità/anno per ICR ≥ 2.</li>
    </ul>
    <p class="muted">Combina le azioni con realismo (mercato, concorrenza, capacità produttiva).</p>
  `;
}

// Events
document.getElementById('calcBtn').addEventListener('click', render);
document.getElementById('resetBtn').addEventListener('click', () => { ids.forEach(id => el(id).value = 0); render(); });
document.getElementById('planBtn').addEventListener('click', () => {
  const html = plan();
  const box = document.getElementById('planDialog');
  const tgt = document.getElementById('planContent');
  tgt.innerHTML = html;
  if (box?.showModal) box.showModal(); else alert(tgt.textContent);
});
document.getElementById('helpBtn').addEventListener('click', () => {
  const box = document.getElementById('helpDialog');
  if (box?.showModal) box.showModal(); else alert('Compila i dati e premi “Calcola”. Usa “Suggerimento” per il piano d’azione.');
});

// Live calc
ids.forEach(id => {
  el(id).addEventListener('input', render, {passive:true});
});

// PWA install prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault(); deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  btn.classList.remove('hide');
  btn.addEventListener('click', async ()=>{
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt=null;
  }, {once:true});
});

// Auto-calc on load with defaults
window.addEventListener('DOMContentLoaded', render);
