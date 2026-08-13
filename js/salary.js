/* Цалин. Ажилтан зөвхөн өнөөдрийнхөө бүртгэлийг хардаг. */
import { db, state } from './state.js';
import { esc, num, money, dayKey, monthKey, dateStr, timeStr, itemName,
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
    const isDay = S().period==="day";
    const salary = fixed ? (+w.salary||0) : 0;
    const advance = w.hasAdvance ? (+w.advance||0) : 0;

    /* Сарын дүнгүүд өдрийн нийт цалинг гажуудуулахгүйн тулд
       "Өнөөдөр" дээр зөвхөн харагдана, нийтэд нэмэгдэхгүй. */
    const earned = fixed ? (isDay ? 0 : salary) : (totals[w.id]||0);
    const adv = isDay ? 0 : advance;
    const t = earned - adv;
    sum+=t;

    let shown = (fixed && isDay) ? `<span style="color:var(--muted)">сараар</span>` : money(t);
    if(!state.isAdmin && fixed) shown=`<span style="color:var(--muted)">тогтмол</span>`;

    const tags=[];
    if(fixed)   tags.push("тогтмол "+money(salary));
    if(advance) tags.push("урьдчилгаа "+money(advance));
    const tag = tags.length ? ` <small>${tags.join(" · ")}</small>` : "";
    const open = S().open===w.id;
    return `<div class="item-row" style="cursor:pointer" onclick="toggleSalDetail('${w.id}')">
        <span class="item-name">${esc(w.name)}${tag}</span>
        <span class="item-val">${shown}</span></div>`
      + (open ? (fixed ? fixedDetail(w,salary,advance,isDay) : detailHTML(w.id,totals[w.id]||0,advance,isDay)) : "");
  }).join("");
  $("salList").innerHTML = html + `<div class="total-line"><span>Нийт</span><b>${money(sum)}</b></div>`;
}
/* Тогтмол цалин, урьдчилгаа хоёр сараар тооцогддог.
   "Өнөөдөр" дээр байгааг нь мэдэгдүүлэхийн тулд тусад нь харуулна. */
/* Тогтмол цалин, урьдчилгаа хоёр сараар тооцогддог.
   "Өнөөдөр" дээр байгааг нь мэдэгдүүлэхийн тулд тусад нь харуулна. */
function monthlyBlock(salary,advance,isDay,earned){
  if(!salary && !advance) return "";
  let rows="";
  if(salary)  rows+=`<tr><td colspan="4" class="nm">Сарын тогтмол цалин</td><td class="amt">${money(salary)}</td></tr>`;
  if(!salary && advance) rows+=`<tr><td colspan="4" class="nm">Хугацааны цалин</td><td class="amt">${money(earned)}</td></tr>`;
  if(advance) rows+=`<tr><td colspan="4" class="nm">Урьдчилгаа</td><td class="amt" style="color:var(--rust)">−${money(advance)}</td></tr>`;
  rows+=`<tr class="sum"><td colspan="4">${isDay?"Сард гарт олгох":"Гарт олгох"}</td>
         <td class="amt">${money((salary||earned)-advance)}</td></tr>`;
  return `<div class="grp-head">${isDay?"Сарын тооцоо":"Нийт тооцоо"}</div>
    <div class="tbl-wrap"><table class="tbl">${rows}</table></div>`;
}

function fixedDetail(w,salary,advance,isDay){
  /* Тогтмол цалинтай хүнийг Оруулах дэлгэц дээр чагтласан бол тэр бүртгэл
     нь хаана ч харагдахгүй байсныг мэдэгдүүлэхийн тулд хүснэгтээ бас гаргана.
     Дүн нь мэдээллийн зорилготой — цалинд нэмэгдэхгүй. */
  const t=entriesTable(w.id);
  const work = t ? `<div class="grp-head">Хийсэн ажил</div>${t.html}
      <div class="tbl-note">Тогтмол цалинтай тул эдгээр дүн цалинд нэмэгдэхгүй.</div>` : "";
  return `<div class="sal-detail">${monthlyBlock(salary,advance,isDay,0)}${work}</div>`;
}

/* Оруулалт бүрийг он сар өдөр, цагтай нь хүснэгтээр харуулна.
   Мөрүүд өдрөөр бүлэглэгдэж, өдөр бүрийн дүн тусдаа гарна. */
function entriesTable(wid){
  const days={};
  let total=0;
  db.log.forEach(e=>{
    if(e.action!=="in" || e.worker!==wid || !inPeriod(e.ts)) return;
    const q=qtyFor(e); if(q<=0) return;
    const dk=dayKey(e.ts);
    const d = days[dk] = days[dk] || {ts:e.ts, sum:0, rows:[]};
    if(e.ts>d.ts) d.ts=e.ts;
    const pay=payFor(e);
    d.sum+=pay; total+=pay;
    d.rows.push({ts:e.ts, item:e.item, qty:q, rate:rateOf(wid,e.item), pay});
  });
  const dks=Object.keys(days).sort((a,b)=>days[b].ts-days[a].ts);
  if(!dks.length) return null;

  const body=dks.map(dk=>{
    const d=days[dk];
    const head=`<tr class="day-head"><td colspan="4">${dateStr(new Date(d.ts))}</td>
      <td class="amt">${money(d.sum)}</td></tr>`;
    const rows=d.rows.sort((a,b)=>a.ts-b.ts).map(r=>{
      const u=payUnitOf(r.item);
      return `<tr>
        <td class="dim">${timeStr(new Date(r.ts))}</td>
        <td class="nm">${esc(itemName(r.item))}</td>
        <td class="num">${num(r.qty)} ${uShort(u)}</td>
        <td class="num dim">${money(r.rate)}</td>
        <td class="amt">${money(r.pay)}</td></tr>`;
    }).join("");
    return head+rows;
  }).join("");

  const html=`<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Цаг</th><th>Бараа</th><th class="num">Хэмжээ</th><th class="num">Тариф</th><th class="num">Дүн</th></tr></thead>
      <tbody>${body}
        <tr class="sum"><td colspan="4">${periodLabel()} нийт</td><td class="amt">${money(total)}</td></tr>
      </tbody></table></div>`;
  return {html,total};
}

function detailHTML(wid,earned,advance,isDay){
  const t=entriesTable(wid);
  if(!t){
    return `<div class="sal-detail"><div class="empty">Энэ хугацаанд бүртгэл алга</div>
      ${monthlyBlock(0,advance,isDay,earned)}</div>`;
  }
  return `<div class="sal-detail">${t.html}${monthlyBlock(0,advance,isDay,earned)}</div>`;
}
function periodLabel(){
  const p=S().period;
  return p==="day" ? "Өнөөдөр" : (p==="month" ? "Энэ сар" : "Бүх хугацаа");
}
registerScreen("scrSalary", renderSalary);
