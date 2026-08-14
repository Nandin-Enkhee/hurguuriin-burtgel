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
function worksOf(wid){
  return (db.works||[]).filter(x=>x.worker===wid && inPeriod(x.ts) && qtyFor(x)>0);
}
function workedDays(wid){
  const set={};
  worksOf(wid).forEach(x=>{ set[dayKey(x.ts)]=x.ts; });
  return set;
}
function pieceTotal(wid){
  return worksOf(wid).reduce((s,x)=>s+payFor(x),0);
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
    else if(e.days) tags.push(`${e.days} өдөр ажилласан`);
    if(p.adv) tags.push(`урьдчилгаа ${money(p.adv)}`);
    if(p.out) tags.push(`олгосон ${money(p.out)}`);
    const tag = tags.length ? ` <small>${tags.join(" · ")}</small>` : "";
    const open = S().open===w.id;
    const done = e.amount>0 && rest<=0.5;
    const badge = e.amount<=0 ? "" :
      (done ? ` <span class="pill pill-ok">олгосон</span>`
            : ` <span class="pill pill-due">үлдэгдэлтэй</span>`);
    return `<div class="item-row" style="cursor:pointer" onclick="toggleSalDetail('${w.id}')">
        <span class="item-name">${esc(w.name)}${badge}${tag}</span>
        <span class="item-val">${money(rest)}${e.amount!==rest?`<small>олсон ${money(e.amount)}</small>`:""}</span></div>`
      + (open ? detailHTML(w,e,p,rest) : "");
  }).join("");
  const paidAll=sumEarn-sumRest;
  $("salList").innerHTML = html + `
    <div class="total-line"><span>${periodLabel()} · олсон</span><b>${money(sumEarn)}</b></div>
    <div class="item-row"><span class="item-name">Олгосон, урьдчилгаа</span>
      <span class="item-val" style="color:var(--moss)">−${money(paidAll)}</span></div>
    <div class="item-row"><span class="item-name">Олгох үлдэгдэл</span>
      <span class="item-val" style="color:var(--rust)">${money(sumRest)}</span></div>`;
  $("salAddCard").style.display = state.isAdmin ? "block" : "none";
}

/* ---------- Дэлгэрэнгүй ----------
   1) Ангилал бүрээр нэгтгэсэн дүн
   2) Өдөр бүрийн задаргаа
   3) Урьдчилгаа, олгосон цалин огноотойгоо
   4) Төлөв: тооцоо дууссан эсэх                                   */
function detailHTML(w,e,p,rest){
  const fixed = w.payType==="fixed";
  const parts=[];

  parts.push(fixed ? fixedTable(w,e) : (itemSummary(w.id,e.amount) || emptyBox()));
  if(!fixed){
    const byDay=entriesTable(w.id,e.amount);
    if(byDay) parts.push(`<div class="grp-head">Өдөр бүрээр</div>`+byDay);
  }
  parts.push(paysTable(w.id,e.amount,p,rest));
  parts.push(statusBox(rest,e.amount));
  if(state.isAdmin){
    parts.push(`<div class="row-2" style="margin:12px 0 2px">
      <button class="btn btn-sm" onclick="addAdvance('${w.id}')">Урьдчилгаа өгөх</button>
      <button class="btn btn-in btn-sm" onclick="addPayout('${w.id}',${rest})">Цалин олгосон</button></div>`);
  }
  return `<div class="sal-detail">${parts.join("")}</div>`;
}
function emptyBox(){ return `<div class="empty">Энэ хугацаанд ажлын бүртгэл алга</div>`; }

function statusBox(rest,earned){
  if(earned<=0) return "";
  if(rest<=0.5) return `<div class="item-row"><span class="item-name">Төлөв</span>
      <span class="item-val"><span class="pill pill-ok">Цалин бүрэн олгогдсон</span></span></div>`;
  return `<div class="item-row"><span class="item-name">Төлөв</span>
      <span class="item-val"><span class="pill pill-due">${money(rest)} олгоогүй</span></span></div>`;
}

/* Ангилал бүрээр — сонгосон хугацаанд нийт хэдэн кг/ширхэг хийж, хэдэн төгрөг олсон */
function itemSummary(wid,total){
  const rows={};
  worksOf(wid).forEach(x=>{
    const r = rows[x.item] = rows[x.item] || {qty:0,sum:0,days:{}};
    r.qty += qtyFor(x);
    r.sum += payFor(x);
    r.days[dayKey(x.ts)]=1;
  });
  const ids=Object.keys(rows);
  if(!ids.length) return null;
  return `<div class="grp-head">Ангилал бүрээр</div>
    <div class="tbl-wrap"><table class="tbl" style="min-width:340px">
      <thead><tr><th>Бараа</th><th class="num">Нийт хэмжээ</th><th class="num">Тариф</th><th class="num">Дүн</th></tr></thead>
      <tbody>${ids.map(id=>{
        const r=rows[id], u=payUnitOf(id);
        return `<tr>
          <td class="nm">${esc(itemName(id))}<div class="dim">${Object.keys(r.days).length} өдөр</div></td>
          <td class="num">${num(r.qty)} ${uShort(u)}</td>
          <td class="num dim">${money(rateOf(wid,id))}</td>
          <td class="amt">${money(r.sum)}</td></tr>`;
      }).join("")}
        <tr class="sum"><td colspan="3">${periodLabel()} · олсон</td><td class="amt">${money(total)}</td></tr>
      </tbody></table></div>`;
}

/* Тогтмол цалинтай — ажилласан өдрүүд */
function fixedTable(w,e){
  const days=workedDays(w.id);
  const dks=Object.keys(days).sort((a,b)=>days[b]-days[a]);
  const rate=+w.salary||0;
  if(!dks.length) return emptyBox();
  return `<div class="grp-head">Ажилласан өдрүүд</div>
    <div class="tbl-wrap"><table class="tbl" style="min-width:0">
    <thead><tr><th>Огноо</th><th class="num">Өдрийн хөлс</th><th class="num">Дүн</th></tr></thead>
    <tbody>${dks.map(dk=>`<tr>
        <td class="nm">${dateStr(new Date(days[dk]))}</td>
        <td class="num dim">${money(rate)}</td>
        <td class="amt">${money(rate)}</td></tr>`).join("")}
      <tr class="sum"><td colspan="2">${dks.length} өдөр · нийт</td><td class="amt">${money(e.amount)}</td></tr>
    </tbody></table></div>`;
}

/* Өдөр бүрийн задаргаа */
function entriesTable(wid,total){
  const days={};
  worksOf(wid).forEach(e=>{
    const dk=dayKey(e.ts);
    const d = days[dk] = days[dk] || {ts:e.ts, sum:0, rows:[]};
    if(e.ts>d.ts) d.ts=e.ts;
    const pay=payFor(e);
    d.sum+=pay;
    d.rows.push({id:e.id,ts:e.ts,item:e.item,qty:qtyFor(e),rate:rateOf(wid,e.item),pay});
  });
  const dks=Object.keys(days).sort((a,b)=>days[b].ts-days[a].ts);
  if(!dks.length) return null;
  const body=dks.map(dk=>{
    const d=days[dk];
    return `<tr class="day-head"><td colspan="3">${dateStr(new Date(d.ts))}</td>
        <td class="amt">${money(d.sum)}</td><td></td></tr>`
      + d.rows.map(r=>`<tr>
          <td class="nm">${esc(itemName(r.item))}</td>
          <td class="num">${num(r.qty)} ${uShort(payUnitOf(r.item))}</td>
          <td class="num dim">${money(r.rate)}</td>
          <td class="amt">${money(r.pay)}</td>
          <td>${state.isAdmin?`<button class="icon-btn" style="padding:4px 8px;font-size:12px"
                 onclick="event.stopPropagation();delWork('${r.id}')">✕</button>`:""}</td></tr>`).join("");
  }).join("");
  return `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Бараа</th><th class="num">Хэмжээ</th><th class="num">Тариф</th><th class="num">Дүн</th><th></th></tr></thead>
    <tbody>${body}</tbody></table></div>`;
}

/* Урьдчилгаа ба олгосон цалин — огноотой */
function paysTable(wid,earned,p,rest){
  const list=paysOf(wid);
  const rows=list.map(x=>`<tr>
      <td class="nm">${dateStr(new Date(x.ts))}</td>
      <td>${x.kind==="advance"?`<span class="pill pill-due">Урьдчилгаа</span>`:`<span class="pill pill-ok">Цалин олгов</span>`}
          ${x.note?`<div class="dim">${esc(x.note)}</div>`:""}</td>
      <td class="amt" style="color:var(--rust)">−${money(x.amount)}</td>
      <td>${state.isAdmin?`<button class="icon-btn" style="padding:4px 8px;font-size:12px"
             onclick="event.stopPropagation();delWagePay('${x.id}')">✕</button>`:""}</td></tr>`).join("");
  return `<div class="grp-head">Олголтын түүх</div>
    <div class="tbl-wrap"><table class="tbl" style="min-width:340px">
      <thead><tr><th>Огноо</th><th>Төрөл</th><th class="num">Дүн</th><th></th></tr></thead>
      <tbody>
        <tr><td class="nm">—</td><td>Олсон цалин</td><td class="amt">${money(earned)}</td><td></td></tr>
        ${rows || `<tr><td colspan="4" class="dim">Олголт бүртгэгдээгүй байна</td></tr>`}
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
  const note=(prompt("Тайлбар (заавал биш)", kind==="payout" ? periodLabel()+" цалин" : "")||"").trim();
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

/* ===================== Сарын нэгтгэл хүснэгт =====================
   Мөр нь ажилчин, багана нь өдөр. Доор нь ажилчин тус бүрээр
   ямар ангилал дээр хэдийг хийсэн задаргаа. */
const MX = () => state.matrix;

export function openMatrix(){
  if(!requireOnline()) return;
  if(!state.isAdmin){ toast("Энэ хэсэг зөвхөн админд нээлттэй"); return; }
  MX().month = MX().month || S().month || isoMonth();
  $("mxMonth").value=MX().month;
  renderMatrix(); show("scrMatrix");
}
export function setMatrixMonth(v){ MX().month = v || isoMonth(); renderMatrix(); }

function monthWorks(){
  const mk=monthKeyOfIso(MX().month||isoMonth());
  return (db.works||[]).filter(x=>monthKey(x.ts)===mk && qtyFor(x)>0);
}
function dayNo(ts){ return new Date(ts).getDate(); }

export function renderMatrix(){
  const a=(MX().month||isoMonth()).split("-");
  $("mxTitle").textContent = a[0]+" оны "+(+a[1])+"-р сар";
  const works=monthWorks();
  if(!works.length){
    $("mxBody").innerHTML=`<div class="card"><div class="empty">Энэ сард ажлын бүртгэл алга</div></div>`;
    return;
  }
  /* Өгөгдөлтэй өдрүүдийг л багана болгоно */
  const dset={};
  works.forEach(x=>{ dset[dayNo(x.ts)]=1; });
  const days=Object.keys(dset).map(Number).sort((p,q)=>p-q);
  const ws=liveWorkers();

  /* --- Нэгдсэн хүснэгт: ажилчин × өдөр --- */
  const cell={};   /* cell[wid][day] = мөнгө */
  ws.forEach(w=>{ cell[w.id]={}; });
  works.forEach(x=>{
    if(!cell[x.worker]) cell[x.worker]={};
    cell[x.worker][dayNo(x.ts)] = (cell[x.worker][dayNo(x.ts)]||0) + payFor(x);
  });
  /* Тогтмол цалинтай хүн: ажилласан өдөр тутамд өдрийн хөлс */
  ws.forEach(w=>{
    if(w.payType!=="fixed") return;
    const worked={};
    works.filter(x=>x.worker===w.id).forEach(x=>{ worked[dayNo(x.ts)]=1; });
    Object.keys(worked).forEach(d=>{ cell[w.id][d]=+w.salary||0; });
  });

  const shown=ws.filter(w=>Object.keys(cell[w.id]).length);
  const colTotal={}, grand={total:0};
  const col = d => `${+a[1]}/${d}`;   /* 8-р сарын 1 → 8/1 */
  const headRow=`<tr><th>Нэр / он сар</th>${days.map(d=>`<th class="num">${col(d)}</th>`).join("")}<th class="num">Нийт</th></tr>`;
  const bodyRows=shown.map(w=>{
    let t=0;
    const tds=days.map(d=>{
      const v=cell[w.id][d]||0;
      t+=v; colTotal[d]=(colTotal[d]||0)+v;
      return `<td class="num${v?"":" dim"}">${v?money(v):"—"}</td>`;
    }).join("");
    grand.total+=t;
    return `<tr><td class="nm">${esc(w.name)}</td>${tds}<td class="amt">${money(t)}</td></tr>`;
  }).join("");
  const sumRow=`<tr class="sum"><td>Нийт</td>${days.map(d=>`<td class="num">${money(colTotal[d]||0)}</td>`).join("")}<td class="amt">${money(grand.total)}</td></tr>`;

  let html=`<div class="card"><h3>Ажилчдын цалин · өдрөөр</h3>
    <div class="tbl-wrap"><table class="tbl" style="min-width:${180+days.length*90}px">
      <thead>${headRow}</thead><tbody>${bodyRows}${sumRow}</tbody></table></div></div>`;

  /* --- Ажилчин тус бүрийн задаргаа: ангилал × өдөр --- */
  html += shown.map(w=>{
    const mine=works.filter(x=>x.worker===w.id);
    const items={};
    mine.forEach(x=>{
      const r = items[x.item] = items[x.item] || {};
      r[dayNo(x.ts)] = (r[dayNo(x.ts)]||0) + qtyFor(x);
    });
    const ids=Object.keys(items);
    const rows=ids.map(id=>{
      const u=uShort(payUnitOf(id));
      let tot=0;
      const tds=days.map(d=>{
        const v=items[id][d]||0; tot+=v;
        return `<td class="num${v?"":" dim"}">${v?num(v)+" "+u:"—"}</td>`;
      }).join("");
      return `<tr><td class="nm">${esc(itemName(id))}</td>${tds}<td class="amt">${num(tot)} ${u}</td></tr>`;
    }).join("");
    return `<div class="card"><h3>${esc(w.name)} · дэлгэрэнгүй</h3>
      <div class="tbl-wrap"><table class="tbl" style="min-width:${180+days.length*90}px">
        <thead><tr><th>Ангилал</th>${days.map(d=>`<th class="num">${col(d)}</th>`).join("")}<th class="num">Нийт</th></tr></thead>
        <tbody>${rows}</tbody></table></div></div>`;
  }).join("");

  $("mxBody").innerHTML=html;
}
registerScreen("scrMatrix", renderMatrix);
