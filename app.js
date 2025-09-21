// v4 SAFE
console.info('RischioImpresa v4 SAFE loaded');

// Helpers (ASCII-only)
function fmtEUR0(n){ return isFinite(n) ? n.toLocaleString('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}) : '—'; }
function fmtEUR(n){ return isFinite(n) ? n.toLocaleString('it-IT',{style:'currency',currency:'EUR'}) : '—'; }
function fmtPCT(n){ return isFinite(n) ? (n*100).toFixed(1)+'%' : '—'; }
function fmtNUM(n){ return isFinite(n) ? n.toLocaleString('it-IT') : '—'; }
function el(id){ return document.getElementById(id); }
var ids = ['p','cv','cf','q','debt','rate','equity'];
function vals(){ var o={}; ids.forEach(function(k){ o[k]= Number(el(k).value)||0; }); return o; }

// Theme toggle
(function initTheme(){
  var root=document.documentElement;
  var saved=localStorage.getItem('ri.theme'); // 'light'|'dark'|'auto'
  root.setAttribute('data-theme', saved || 'auto');
  function label(){ var cur=root.getAttribute('data-theme'); return (cur==='dark')?'☀️':(cur==='light')?'🌙':'🌓'; }
  var tbtn=el('themeBtn'); if(tbtn){ tbtn.textContent=label(); tbtn.addEventListener('click', function(){
    var cur=root.getAttribute('data-theme');
    var next=(cur==='auto')?'dark':(cur==='dark')?'light':'auto';
    root.setAttribute('data-theme', next);
    localStorage.setItem('ri.theme', next);
    tbtn.textContent=label();
  });}
})();

// Core model
function riskScore(v){
  var p=v.p, cv=v.cv, cf=v.cf, q=v.q, debt=v.debt, rate=v.rate;
  var mc_u = p - cv;
  var rev = p*q;
  var varCost = cv*q;
  var ebit = rev - varCost - cf;
  var interest = debt*(rate/100);
  var icr = interest>0 ? ebit/interest : (ebit>0?10: (ebit<0? -10: 0));
  var bep_u = mc_u>0 ? (cf/mc_u) : Infinity;
  var safety = (q>0 && isFinite(bep_u)) ? (q - bep_u)/q : -1;
  var mcp = p>0 ? mc_u/p : 0;
  var dol = (ebit!==0) ? ((rev-varCost)/Math.max(ebit, -1e6)) : 99;

  var s1 = Math.max(0, Math.min(100, (safety*100))); s1 = s1/0.8; if(s1>100) s1=100;
  var s2 = Math.max(0, Math.min(100, (mcp*100)));    s2 = (s2/40)*100; if(s2>100) s2=100;
  var s3 = Math.max(0, Math.min(100, (icr>=0? Math.min(icr,4)/2*100 : 0))); if (s3>100) s3=100;
  var s4 = Math.max(0, Math.min(100, 100 - Math.min(Math.abs(dol),10)/10*100));

  var score = Math.round(0.35*s1 + 0.25*s2 + 0.25*s3 + 0.15*s4);
  return { score:score, mc_u:mc_u, mcp:mcp, bep_u:bep_u, rev:rev, varCost:varCost, ebit:ebit, interest:interest, icr:icr, dol:dol, safety:safety };
}

function render(){
  try{
    var v=vals(), r=riskScore(v);
    el('mc_u').textContent = fmtEUR(r.mc_u);
    el('mc_pct').textContent = fmtPCT(r.mcp);
    el('bep_u').textContent = isFinite(r.bep_u) ? fmtNUM(Math.ceil(r.bep_u)) : '—';
    el('bep_rev').textContent = isFinite(r.bep_u) ? fmtEUR(Math.ceil(r.bep_u)*v.p) : '—';
    el('rev').textContent = fmtEUR(r.rev);
    el('ebit').textContent = fmtEUR(r.ebit);
    el('int').textContent = fmtEUR(r.interest);
    el('icr').textContent = isFinite(r.icr) ? r.icr.toFixed(2) : '—';
    el('dol').textContent = isFinite(r.dol) ? (Math.abs(r.dol)>50? '›50' : r.dol.toFixed(2)) : '—';
    el('scoreBadge').textContent = 'Score: '+r.score+'/100';
    el('scoreBar').firstElementChild.style.width = r.score+'%';
    el('scoreNote').textContent = (r.score<40)?'Rischio ALTO: agisci subito.':(r.score<70)?'Rischio MEDIO: migliora i fondamentali.':'Rischio BASSO: continua così ma monitora.';
  }catch(err){ console.error('render error', err); }
}

function buildPlan(){
  var v=vals(), r=riskScore(v);
  if (!isFinite(r.bep_u) || r.mc_u<=0){
    return '<p>Il prezzo è ≤ ai costi variabili. Aumenta il <strong>prezzo</strong> o riduci i <strong>costi variabili</strong> per creare margine.</p>';
  }
  var targetSafety=0.20, targetICR=2.0;
  var bep=r.bep_u;
  var qTarget=Math.max(v.q, Math.ceil(bep/(1-targetSafety)));
  var addUnits=Math.max(0, qTarget - v.q);
  var mc_needed=v.cf / (v.q*(1-targetSafety));
  var pTarget=mc_needed + v.cv;
  var dPrice=Math.max(0, pTarget - v.p);
  var cfTarget=(v.p - v.cv) * v.q * (1 - targetSafety);
  var cutCF=Math.max(0, v.cf - cfTarget);
  var interest=v.debt*(v.rate/100);
  var needEBITforICR=interest*targetICR;
  var deltaEBIT_ICR=Math.max(0, needEBITforICR - r.ebit);
  var unitsForICR=r.mc_u>0 ? Math.ceil(deltaEBIT_ICR / r.mc_u) : Infinity;
  function fmt(n){ return isFinite(n) ? n.toLocaleString('it-IT') : '—'; }
  return '<ul>' +
    '<li><strong>Aumenta volumi</strong>: +<b>'+fmt(addUnits)+'</b> unità/anno (safety ≥ 20%).</li>'+
    '<li><strong>Aggiusta prezzo</strong>: +<b>'+fmtEUR(dPrice)+'</b> per unità (a parità di Q).</li>'+
    '<li><strong>Taglia costi fissi</strong>: −<b>'+fmtEUR(cutCF)+'</b>.</li>'+
    '<li><strong>Copri oneri</strong>: +<b>'+fmt(unitsForICR)+'</b> unità/anno per ICR ≥ 2.</li>'+
  '</ul><p class="muted">Combina le azioni con realismo (mercato, concorrenza, capacità).</p>';
}

// Events (after DOM ready)
document.addEventListener('DOMContentLoaded', function(){
  var cb=el('calcBtn'); if(cb) cb.addEventListener('click', render);
  var rb=el('resetBtn'); if(rb) rb.addEventListener('click', function(){ ids.forEach(function(id){ el(id).value=0; }); render(); });
  ids.forEach(function(id){ var n=el(id); if(n) n.addEventListener('input', render, {passive:true}); });

  var pb=el('planBtn'); if(pb) pb.addEventListener('click', function(){
    var box=el('planDialog'), tgt=el('planContent');
    if(tgt) tgt.innerHTML = buildPlan();
    if (box && box.showModal) box.showModal(); else alert(tgt ? tgt.textContent : 'Apri dopo Calcola');
  });
  var hb=el('helpBtn'); if(hb) hb.addEventListener('click', function(){
    var box=el('helpDialog'); if (box && box.showModal) box.showModal(); else alert('Compila i dati e premi “Calcola”. Usa “Suggerimento” per il piano d’azione.');
  });

  // Install handling
  var ib=el('installBtn'); var how=el('howBtn'); var deferred=null;
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault(); deferred=e; if(ib) ib.classList.remove('hide');
  });
  if(ib) ib.addEventListener('click', function(){ if(deferred){ deferred.prompt(); deferred.userChoice.then(function(){ deferred=null; }); } });
  if(how) how.addEventListener('click', function(){
    alert('Installazione:\n• iPhone/iPad (Safari): Condividi → Aggiungi a Home\n• Android (Chrome): menu ⋮ → Installa app / Aggiungi a schermata Home\n• Desktop (Chrome/Edge): icona Installa nella barra URL');
  });

  render();
});
