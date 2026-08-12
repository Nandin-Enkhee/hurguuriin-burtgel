/* Цалин. Ажилтан зөвхөн өнөөдрийнхөө бүртгэлийг хардаг. */
import { db, state } from './state.js';
import { esc, num, money, dayKey, monthKey, fullDateTime, itemName,
         payUnitOf, uShort, rateOf, qtyFor, payFor, liveWorkers } from './util.js';
import { $ } from './ui.js';
import { show, registerScreen } from './router.js';

const S = () => state.salary;

function inPeriod(ts){
  const p=S().period;
  if(p==="all") return true;
  const now=Date.now();
  return p==="day" ? dayKey(ts)===dayKey(now) : monthKey(ts)===monthKey(now);
}
export function openSalary(){
  S().open=null;
  if(!state.isAdmin){
    S().period="day";
    $("salSeg").style.display="none";
    $("salNote").style.display="block";
  }else{
    $("salSeg").style.display="flex";
    $("salNote").style.display="none";
  }
  renderSalary(); show("scrSalary");
}
export function setPeriod(p,btn){
  if(!state.isAdmin) return;
  S().period=p;
  document.querySelectorAll("#salSeg button").forEach(b=>b.classList.remove("on"));
  btn.classList.add("on");
  renderSalary();
}
export function toggleSalDetail(wid){
  S().open = S().open===wid ? null : wid;
  renderSalary();
}

export function renderSalary(){
  const totals={};
  db.log.forEach(e=>{
    if(e.action!=="in" || !e.worker || !inPeriod(e.ts)) return;
    totals[e.worker]=(totals[e.worker]||0)+payFor(e);
  });
  const ws=liveWorkers();
  if(!ws.length){ $("salList").innerHTML=`<div class="empty">Ажилчин бүртгээгүй байна</div>`; return; }

  let sum=0;
  const html=ws.map(w=>{
    const fixed = w.payType==="fixed";
    /* Тогтмол цалин сараар тооцогддог тул өдрийн дүнд нэмэгдэхгүй */
    const counts = fixed ? S().period!=="day" : true;
    const t = fixed ? (counts ? (+w.salary||0) : 0) : (totals[w.id]||0);
    sum+=t;
    let shown = fixed && !counts ? `<span style="color:var(--muted)">сараар</span>` : money(t);
    if(!state.isAdmin && fixed) shown=`<span style="color:var(--muted)">тогтмол</span>`;
    const tag = fixed ? ` <small>тогтмол</small>` : "";
    const open = S().open===w.id;
    return `<div class="item-row" style="cursor:pointer" onclick="toggleSalDetail('${w.id}')">
        <span class="item-name">${esc(w.name)}${tag}</span>
        <span class="item-val">${shown}</span></div>`
      + (open ? (fixed ? fixedDetail(w) : detailHTML(w.id)) : "");
  }).join("");
  $("salList").innerHTML = html + `<div class="total-line"><span>Нийт</span><b>${money(sum)}</b></div>`;
}
function fixedDetail(w){
  return `<div class="sal-detail"><div class="item-row">
    <span class="item-name">Сарын тогтмол цалин</span>
    <span class="item-val">${money(+w.salary||0)}</span></div></div>`;
}
/* Оруулалт бүрийг тусад нь, он сар цаг минуттай нь харуулна */
function detailHTML(wid){
  const groups={};
  db.log.forEach(e=>{
    if(e.action!=="in" || e.worker!==wid || !inPeriod(e.ts)) return;
    const q=qtyFor(e); if(q<=0) return;
    const g = groups[e.ts] = groups[e.ts] || {ts:e.ts,sum:0,items:{}};
    const r = g.items[e.item] = g.items[e.item] || {parts:[],qty:0,sum:0};
    r.parts.push(num(q)); r.qty+=q;
    const pay=payFor(e); r.sum+=pay; g.sum+=pay;
  });
  const gks=Object.keys(groups).sort((a,b)=>groups[b].ts-groups[a].ts);
  if(!gks.length) return `<div class="sal-detail"><div class="empty">Энэ хугацаанд бүртгэл алга</div></div>`;
  return `<div class="sal-detail">${gks.map(gk=>{
    const g=groups[gk];
    return `<div class="calc-w">
      <div class="calc-head"><span>${fullDateTime(g.ts)}</span><b>${money(g.sum)}</b></div>
      ${Object.keys(g.items).map(iid=>{
        const r=g.items[iid], u=payUnitOf(iid);
        const chain = r.parts.length>1 ? r.parts.join("+")+" = "+num(r.qty) : String(num(r.qty));
        return `<div class="item-row"><span class="item-name">${esc(itemName(iid))}
          <span class="chain">${chain} ${uShort(u)} × ${money(rateOf(wid,iid))}</span></span>
          <span class="item-val">${money(r.sum)}</span></div>`;
      }).join("")}</div>`;
  }).join("")}</div>`;
}
registerScreen("scrSalary", renderSalary);
