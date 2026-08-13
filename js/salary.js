/* Цалин.
   - Хэсгийн цалин: оруулсан тоо хэмжээ × тариф
   - Тогтмол цалин: НЭГ ӨДРИЙН дүн, ажилласан өдөр бүрд бодогдоно
   - Урьдчилгаа, олгосон цалин хоёр огноотой бичигдэж, цалингаас хасагдана
   Ажилтан зөвхөн өнөөдрийнхөө бүртгэлийг хардаг. */
import { db, state, uid, saveLocal } from './state.js';
import { esc, f, num, money, dayKey, monthKey, dayKeyOfIso, monthKeyOfIso,
         isoStr, isoMonth, tsOfIso, dateStr, timeStr, itemName,
         payUnitOf, uShort, rateOf, qtyFor, payFor, liveWorkers, workerName } from './util.js';
import { $, toast } from './ui.js';
import { show, registerScreen } from './router.js';
import { fbSet, fbDel } from './sync.js';
import { requireOnline } from './auth.js';

const S = () => state.salary;

/* ---------- Хугацааны шүүлт ---------- */
function inPeriod(ts){
  const p=S().period;
  if(p==="all") return true;
  if(p==="day")   return dayKey(ts)===dayKeyOfIso(S().date||isoStr());
  return monthKey(ts)===monthKeyOfIso(S().month||isoMonth());
}
function periodLabel(){
  const p=S().period;
  if(p==="day")   return dateStr(new Date((S().date||isoStr())+"T00:00:00"));
  if(p==="month"){ const a=(S().month||isoMonth()).split("-"); return a[0]+" оны "+(+a[1])+"-р сар"; }
  return "Бүх хугацаа";
}

export function openSalary(){
  if(!requireOnline()) return;
  S().open=null;
  S().date  = S().date  || isoStr();
  S().month = S().month || isoMonth();
  if(!state.isAdmin){
    S().period="day"; S().date=isoStr();
    $("salSeg").style.display="none";
    $("salNote").style.display="block";
  }else{
    $("salSeg").style.display="flex";
    $("salNote").style.display="none";
  }
  syncPicker(); renderSalary(); show("scrSalary");
}
function syncPicker(){
  const p=S().period, adm=state.isAdmin;
  const d=$("salDate"), m=$("salMonth");
  d.value=S().date;  d.max=isoStr();
  m.value=S().month; m.max=isoMonth();
  d.style.display = p==="day"   ? "block" : "none";
  m.style.display = p==="month" ? "block" : "none";
  $("salPickCard").style.display = (adm && p!=="all") ? "block" : "none";
  $("salPickTitle").textContent = p==="day" ? "Аль өдрийн цалин" : "Аль сарын цалин";
}
export function setSalDate(v){ S().date = v || isoStr(); renderSalary(); }
export function setSalMonth(v){ S().month = v || isoMonth(); renderSalary(); }
export function setPeriod(p,btn){
  if(!state.isAdmin) return;
  S().period=p; S().open=null;
  document.querySelectorAll("#salSeg button").forEach(b=>b.classList.remove("on"));
  btn.classList.add("on");
  syncPicker(); renderSalary();
}
export function toggleSalDetail(wid){
  S().open = S().open===wid ? null : wid;
  renderSalary();
}

/* ---------- Тооцоо ---------- */
/* Ажилчин тухайн өдөр ажилласан эсэх нь оруулсан бүртгэлээр тодорхойлогдоно */
function workedDays(wid){
  const set={};
  db.log.forEach(e=>{
    if(e.action!=="in" || e.worker!==wid || !inPeriod(e.ts)) return;
    if(qtyFor(e)<=0) return;
    set[dayKey(e.ts)] = e.ts;
  });
  return set;
}
function pieceTotal(wid){
  let s=0;
  db.log.forEach(e=>{
    if(e.action!=="in" || e.worker!==wid || !inPeriod(e.ts)) return;
    s+=payFor(e);
  });
  return s;
}
function earnedOf(w){
  if(w.payType==="fixed"){
    const days=Object.keys(workedDays(w.id)).length;
    return { amount: days*(+w.salary||0), days };
  }
  return { amount: pieceTotal(w.id), days: Object.keys(workedDays(w.id)).length };
}
function paysOf(wid){
  return (db.wagepays||[]).filter(x=>x.worker===wid && inPeriod(x.ts)).sort((a,b)=>b.ts-a.ts);
}
function paidSums(wid){
  let adv=0, out=0;
  paysOf(wid).forEach(x=>{ if(x.kind==="advance") adv+=x.amount; else out+=x.amount; });
  return {adv,out};
}

export function renderSalary(){
  const ws=liveWorkers();
  if(!ws.length){ $("salList").innerHTML=`<div class="empty">Ажилчин бүртгээгүй байна</div>`; return; }
  let sumEarn=0, sumRest=0;
  const html=ws.map(w=>{
    const e=earnedOf(w), p=paidSums(w.id);
    const rest=e.amount-p.adv-p.out;
    sumEarn+=e.amount; sumRest+=rest;
    const tags=[];
    if(w.payType==="fixed") tags.push(`тогтмол ${money(+w.salary||0)}/өдөр · ${e.days} өдөр`);
    if(p.adv) tags.push(`урьдчилгаа ${money(p.adv)}`);
    if(p.out) tags.push(`олгосон ${money(p.out)}`);
    const tag = tags.length ? ` <small>${tags.join(" · ")}</small>` : "";
    const open = S().open===w.id;
    return `<div class="item-row" style="cursor:pointer" onclick="toggleSalDetail('${w.id}')">
        <span class="item-name">${esc(w.name)}${tag}</span>
        <span class="item-val">${money(rest)}${e.amount!==rest?`<small>олсон ${money(e.amount)}</small>`:""}</span></div>`
      + (open ? detailHTML(w,e,p,rest) : "");
  }).join("");
  $("salList").innerHTML = html +
    `<div class="total-line"><span>${periodLabel()} · олсон ${money(sumEarn)}</span><b>${money(sumRest)}</b></div>`;
}

/* ---------- Дэлгэрэнгүй ---------- */
function detailHTML(w,e,p,rest){
  const t = w.payType==="fixed" ? fixedTable(w,e) : entriesTable(w.id,e.amount);
  const work = t || `<div class="empty">Энэ хугацаанд бүртгэл алга</div>`;
  return `<div class="sal-detail">
    ${work}
    ${paysTable(w.id,e.amount,p,rest)}
    ${state.isAdmin ? `<div class="row-2" style="margin:12px 0 2px">
      <button class="btn btn-sm" onclick="addAdvance('${w.id}')">Урьдчилгаа</button>
      <button class="btn btn-in btn-sm" onclick="addPayout('${w.id}',${rest})">Цалин олгосон</button></div>` : ""}
  </div>`;
}

/* Тогтмол цалинтай — ажилласан өдрүүд */
function fixedTable(w,e){
  const days=workedDays(w.id);
  const dks=Object.keys(days).sort((a,b)=>days[b]-days[a]);
  const rate=+w.salary||0;
  if(!dks.length) return null;
  const rows=dks.map(dk=>`<tr>
      <td class="nm">${dateStr(new Date(days[dk]))}</td>
      <td class="num dim">${money(rate)}</td>
      <td class="amt">${money(rate)}</td></tr>`).join("");
  return `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Ажилласан өдөр</th><th class="num">Өдрийн хөлс</th><th class="num">Дүн</th></tr></thead>
    <tbody>${rows}
      <tr class="sum"><td colspan="2">${dks.length} өдөр · нийт</td><td class="amt">${money(e.amount)}</td></tr>
    </tbody></table></div>`;
}

/* Хэсгийн цалин — оруулалт бүр огноо, цагтайгаа */
function entriesTable(wid,total){
  const days={};
  db.log.forEach(e=>{
    if(e.action!=="in" || e.worker!==wid || !inPeriod(e.ts)) return;
    const q=qtyFor(e); if(q<=0) return;
    const dk=dayKey(e.ts);
    const d = days[dk] = days[dk] || {ts:e.ts, sum:0, rows:[]};
    if(e.ts>d.ts) d.ts=e.ts;
    const pay=payFor(e);
    d.sum+=pay;
    d.rows.push({ts:e.ts,item:e.item,qty:q,rate:rateOf(wid,e.item),pay});
  });
  const dks=Object.keys(days).sort((a,b)=>days[b].ts-days[a].ts);
  if(!dks.length) return null;
  const body=dks.map(dk=>{
    const d=days[dk];
    return `<tr class="day-head"><td colspan="4">${dateStr(new Date(d.ts))}</td>
        <td class="amt">${money(d.sum)}</td></tr>`
      + d.rows.sort((a,b)=>a.ts-b.ts).map(r=>`<tr>
          <td class="dim">${timeStr(new Date(r.ts))}</td>
          <td class="nm">${esc(itemName(r.item))}</td>
          <td class="num">${num(r.qty)} ${uShort(payUnitOf(r.item))}</td>
          <td class="num dim">${money(r.rate)}</td>
          <td class="amt">${money(r.pay)}</td></tr>`).join("");
  }).join("");
  return `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Цаг</th><th>Бараа</th><th class="num">Хэмжээ</th><th class="num">Тариф</th><th class="num">Дүн</th></tr></thead>
    <tbody>${body}
      <tr class="sum"><td colspan="4">${periodLabel()} нийт</td><td class="amt">${money(total)}</td></tr>
    </tbody></table></div>`;
}

/* Урьдчилгаа ба олгосон цалин — огноотой */
function paysTable(wid,earned,p,rest){
  const list=paysOf(wid);
  const rows=list.map(x=>`<tr>
      <td class="nm">${dateStr(new Date(x.ts))}</td>
      <td>${x.kind==="advance"?"Урьдчилгаа":"Цалин олгосон"}${x.note?`<div class="dim">${esc(x.note)}</div>`:""}</td>
      <td class="amt" style="color:var(--rust)">−${money(x.amount)}</td>
      <td>${state.isAdmin?`<button class="icon-btn" style="padding:4px 8px;font-size:12px"
             onclick="event.stopPropagation();delWagePay('${x.id}')">✕</button>`:""}</td></tr>`).join("");
  return `<div class="grp-head">Олголт</div>
    <div class="tbl-wrap"><table class="tbl" style="min-width:340px">
      <thead><tr><th>Огноо</th><th>Төрөл</th><th class="num">Дүн</th><th></th></tr></thead>
      <tbody>
        <tr><td class="nm">—</td><td>Олсон цалин</td><td class="amt">${money(earned)}</td><td></td></tr>
        ${rows}
        <tr class="sum"><td colspan="2">Үлдэгдэл</td><td class="amt">${money(rest)}</td><td></td></tr>
      </tbody></table></div>`;
}

/* ---------- Урьдчилгаа, олголт нэмэх ---------- */
function askPay(wid,kind,def){
  if(!requireOnline()) return;
  const label = kind==="advance" ? "урьдчилгаа" : "олгосон цалин";
  const v=prompt(`${workerName(wid)} — ${label} хэдэн төгрөг вэ?`, String(Math.max(0,Math.round(def||0))));
  if(v===null) return;
  const amount=f(v);
  if(amount<=0){ toast("Дүнгээ оруулна уу"); return; }
  const d=prompt("Огноо (ЖЖЖЖ-СС-ӨӨ)", S().period==="day" ? (S().date||isoStr()) : isoStr());
  if(d===null) return;
  const iso=/^\d{4}-\d{2}-\d{2}$/.test(d.trim()) ? d.trim() : isoStr();
  const note=(prompt("Тайлбар (заавал биш)","")||"").trim();
  const rec={id:uid(), ts:tsOfIso(iso), worker:wid, kind, amount:num(amount), note};
  db.wagepays.push(rec);
  saveLocal(); fbSet("wagepays",rec.id,rec);
  renderSalary();
  toast(`${dateStr(new Date(rec.ts))} · ${money(amount)} бүртгэгдлээ`);
}
export function addAdvance(wid){ askPay(wid,"advance",0); }
export function addPayout(wid,rest){ askPay(wid,"payout",rest); }
export function delWagePay(id){
  if(!requireOnline()) return;
  if(!confirm("Энэ бичилтийг устгах уу?")) return;
  db.wagepays=db.wagepays.filter(x=>x.id!==id);
  saveLocal(); fbDel("wagepays",id);
  renderSalary(); toast("Устгалаа");
}
registerScreen("scrSalary", renderSalary);
