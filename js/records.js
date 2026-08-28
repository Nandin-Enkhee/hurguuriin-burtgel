/* Баримт, түүх — сар сонгож өдөр бүрийн хөдөлгөөнийг хүснэгтээр харна.
   Мөр бүр: эхний үлдэгдэл → орсон → гарсан → эцсийн үлдэгдэл. */
import { db, state, saveLocal } from './state.js';
import { esc, num, money, dateStr, timeStr, isoMonth, monthKey, monthKeyOfIso,
         dayKey, itemName, workerName, qtyLine, fridgeName, itemsOf,
         mainUnitOf, uShort, liveItems } from './util.js';
import { $, toast } from './ui.js';
import { show, registerScreen } from './router.js';
import { fbDel } from './sync.js';
import { requireOnline } from './auth.js';

const R = () => state.records;
const selLogs=new Set(), selAudits=new Set();

export function openRecords(){
  if(!state.isAdmin){ toast("Энэ хэсэг зөвхөн админд нээлттэй"); return; }
  if(!requireOnline()) return;
  selLogs.clear();
  R().month = R().month || isoMonth();
  R().openDay=null;
  $("recMonth").value=R().month;
  $("recBtn1").textContent=fridgeName(1);
  $("recBtn2").textContent=fridgeName(2);
  document.querySelectorAll("#recSeg button").forEach((b,i)=>b.classList.toggle("on", i===R().fridge-1));
  renderRecords(); show("scrRecords");
}
export function setRecMonth(v){ R().month = v || isoMonth(); R().openDay=null; renderRecords(); }
export function setRecFridge(id,btn){
  R().fridge=id; R().openDay=null;
  document.querySelectorAll("#recSeg button").forEach(b=>b.classList.remove("on"));
  btn.classList.add("on"); renderRecords();
}
export function toggleRecDay(dk){ R().openDay = R().openDay===dk ? null : dk; renderRecords(); }

/* Сонгосон сарын эхлэхээс өмнөх үлдэгдлийг бүх бараагаар нэг удаагийн
   гүйлтээр гаргана — бараа тус бүрд log-ийг дахин дахин уншихгүй. */
function openingMap(fid,firstTs,ids){
  const map={};
  ids.forEach(id=>{ map[id]={kg:0,pcs:0}; });
  db.log.forEach(e=>{
    if(e.fridge!==fid || e.ts>=firstTs) return;
    const c=map[e.item];
    if(!c) return;
    const s=e.action==="in"?1:-1;
    c.kg+=s*(e.kg||0); c.pcs+=s*(e.pcs||0);
  });
  Object.keys(map).forEach(id=>{ map[id].kg=num(map[id].kg); });
  return map;
}
function qtyOfUnit(kg,pcs,id){ return mainUnitOf(id)==="pcs" ? pcs : num(kg); }

export function renderRecords(){
  const fid=R().fridge, mk=monthKeyOfIso(R().month||isoMonth());
  const rows=db.log.filter(e=>e.fridge===fid && monthKey(e.ts)===mk);

  if(!rows.length){
    $("recList").innerHTML=`<div class="empty">Энэ сард ${esc(fridgeName(fid))}-т хөдөлгөөн бүртгэгдээгүй байна</div>`;
    return;
  }
  /* Өдрөөр бүлэглэнэ */
  const days={};
  rows.forEach(e=>{
    const dk=dayKey(e.ts);
    const d = days[dk] = days[dk] || {ts:e.ts, items:{}, logs:[]};
    if(e.ts<d.ts) d.ts=e.ts;
    const c = d.items[e.item] = d.items[e.item] || {ikg:0,ipcs:0,okg:0,opcs:0};
    if(e.action==="in"){ c.ikg+=(e.kg||0); c.ipcs+=(e.pcs||0); }
    else{ c.okg+=(e.kg||0); c.opcs+=(e.pcs||0); }
    d.logs.push(e);
  });
  const dks=Object.keys(days).sort((a,b)=>days[a].ts-days[b].ts);   /* хуучнаас нь */

  /* Сарын эхний үлдэгдлээс эхэлж өдөр бүрийг дараалан бодно.
     Тохиргооноос хассан бараа ч хуучин бүртгэлдээ үлддэг тул
     идэвхтэй жагсаалт биш, бодит хөдөлгөөнөөс нь барааны жагсаалт гаргана. */
  const first=days[dks[0]].ts;
  const fd=new Date(first);
  const monthStart=new Date(fd.getFullYear(),fd.getMonth(),1).getTime();
  const touched={};
  dks.forEach(dk=>Object.keys(days[dk].items).forEach(id=>{ touched[id]=1; }));
  const running=openingMap(fid,monthStart,Object.keys(touched));

  const blocks=dks.map(dk=>{
    const d=days[dk];
    const ids=Object.keys(d.items);
    const lines=ids.map(id=>{
      const c=d.items[id];
      const open=running[id]||{kg:0,pcs:0};
      const close={kg:num(open.kg+c.ikg-c.okg), pcs:open.pcs+c.ipcs-c.opcs};
      running[id]=close;
      return {id,open,c,close};
    });
    /* Хөдөлгөөнгүй барааны үлдэгдэл хэвээр үлдэнэ */
    const head=`<button type="button" class="exp-head" onclick="toggleRecDay('${dk}')">
        <span class="exp-arrow">${R().openDay===dk?"▾":"▸"}</span>
        <span class="exp-main">${dateStr(new Date(d.ts))}
          <small>${ids.length} төрөл · ${d.logs.length} бичилт</small></span>
        <span class="exp-val mv-in">+${d.logs.filter(x=>x.action==="in").length}</span>
      </button>`;
    const table=`<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Бараа</th><th class="num">Эхэлсэн</th><th class="num">Орсон</th><th class="num">Гарсан</th><th class="num">Үлдсэн</th></tr></thead>
      <tbody>${lines.map(l=>`<tr>
        <td class="nm">${esc(itemName(l.id))}</td>
        <td class="num dim">${qtyOfUnit(l.open.kg,l.open.pcs,l.id)}</td>
        <td class="num" style="color:var(--moss)">${qtyOfUnit(l.c.ikg,l.c.ipcs,l.id)?"+"+qtyOfUnit(l.c.ikg,l.c.ipcs,l.id):"—"}</td>
        <td class="num" style="color:var(--rust)">${qtyOfUnit(l.c.okg,l.c.opcs,l.id)?"−"+qtyOfUnit(l.c.okg,l.c.opcs,l.id):"—"}</td>
        <td class="amt">${qtyOfUnit(l.close.kg,l.close.pcs,l.id)} ${uShort(mainUnitOf(l.id))}</td></tr>`).join("")}
      </tbody></table></div>`;
    const detail = R().openDay===dk ? `<div class="exp-body">${logList(d.logs)}</div>` : "";
    return head+table+detail;
  }).reverse().join("");   /* шинэ өдөр нь дээрээ */

  $("recList").innerHTML = blocks;
}

/* Тухайн өдрийн бичилтүүд — засварлах, устгах */
function logList(logs){
  return `<div class="grp-head">Бичилтүүд</div>` + logs.slice().sort((a,b)=>a.ts-b.ts).map(e=>{
    const on=selLogs.has(e.id);
    const lb = e.action==="out" ? {t:"Зарлага",c:"var(--rust)"}
             : e.purchase ? {t:"Худалдан авсан",c:"var(--moss)"} : {t:"Орлого",c:"var(--blue)"};
    const who=e.by?" · "+workerName(e.by):(e.worker?" · "+workerName(e.worker):"");
    return `<div class="pick" style="display:flex;align-items:center;gap:6px">
      <button type="button" class="check-row${on?" on":""}" style="flex:1" onclick="toggleLogSel('${e.id}')">
        <span class="tick">✓</span>
        <span><b style="color:${lb.c}">${lb.t}</b> ${esc(itemName(e.item))} ${qtyLine(e.kg,e.pcs,e.item)}
          <small>${timeStr(new Date(e.ts))}${esc(who)}</small></span></button>
      ${e.receipt?`<button class="icon-btn pri" onclick="openOneReceipt('${e.receipt}')">Баримт</button>`:""}
    </div>`;
  }).join("") + `<div class="row-2" style="margin-top:10px">
      <button class="btn btn-out btn-sm" onclick="deleteSelectedLogs()">Сонгосныг устгах</button></div>`;
}
export function toggleLogSel(id){
  selLogs.has(id) ? selLogs.delete(id) : selLogs.add(id);
  renderRecords();
}
export function deleteSelectedLogs(){
  if(!requireOnline()) return;
  if(!selLogs.size){ toast("Устгах мөрөө чагтална уу"); return; }
  const ids=Array.from(selLogs);
  const chosen=db.log.filter(e=>ids.indexOf(e.id)>=0);
  const rcIds=[...new Set(chosen.filter(e=>e.receipt).map(e=>e.receipt))];
  const puIds=[...new Set(chosen.filter(e=>e.purchase).map(e=>e.purchase))];
  let msg=`${ids.length} бүртгэлийг устгах уу? Үлдэгдэл автоматаар засагдана.`;
  if(rcIds.length) msg+=`\n\nХолбогдох ${rcIds.length} төлбөрийн баримт бүхэлдээ устана.`;
  if(puIds.length) msg+=`\n\nХолбогдох ${puIds.length} худалдан авалт бүхэлдээ устана.`;
  if(!confirm(msg)) return;

  const delIds=db.log.filter(e =>
    ids.indexOf(e.id)>=0 ||
    (e.receipt && rcIds.indexOf(e.receipt)>=0) ||
    (e.purchase && puIds.indexOf(e.purchase)>=0)
  ).map(e=>e.id);

  db.log=db.log.filter(e=>delIds.indexOf(e.id)<0);
  db.receipts=db.receipts.filter(r=>rcIds.indexOf(r.id)<0);
  db.purchases=db.purchases.filter(p=>puIds.indexOf(p.id)<0);
  saveLocal();
  delIds.forEach(id=>fbDel("log",id));
  rcIds.forEach(id=>fbDel("receipts",id));
  puIds.forEach(id=>fbDel("purchases",id));
  selLogs.clear(); renderRecords(); toast("Устгалаа");
}

/* ---------- Засварын түүх ---------- */
export function openAudit(){
  if(!requireOnline()) return;
  if(!state.isAdmin){ toast("Энэ хэсэг зөвхөн админд нээлттэй"); return; }
  selAudits.clear(); renderAudit(); show("scrAudit");
}
export function toggleAuditSel(id){
  selAudits.has(id) ? selAudits.delete(id) : selAudits.add(id);
  renderAudit();
}
export function renderAudit(){
  const list=(db.audits||[]).slice().sort((a,b)=>b.ts-a.ts).slice(0,80);
  $("auditList").innerHTML = list.length ? list.map(a=>{
    const d=new Date(a.ts), on=selAudits.has(a.id);
    return `<div class="pick">
      <button type="button" class="check-row${on?" on":""}" style="flex:1" onclick="toggleAuditSel('${a.id}')">
        <span class="tick">✓</span>
        <span><b>БАР-${a.no}</b>
          <small>${dateStr(d)} ${timeStr(d)}</small>
          <small style="color:var(--rust)">Өмнө: ${esc(a.before.buyer)} · ${esc(a.before.text)} · ${money(a.before.total)}</small>
          <small style="color:var(--moss)">Дараа: ${esc(a.after.buyer)} · ${esc(a.after.text)} · ${money(a.after.total)}</small>
        </span></button></div>`;
  }).join("") : `<div class="empty">Засвар хийгдээгүй байна</div>`;
}
export function deleteSelectedAudits(){
  if(!requireOnline()) return;
  if(!selAudits.size){ toast("Устгах мөрөө чагтална уу"); return; }
  if(!confirm(`${selAudits.size} бүртгэлийг устгах уу?`)) return;
  const ids=Array.from(selAudits);
  db.audits=(db.audits||[]).filter(a=>ids.indexOf(a.id)<0);
  saveLocal(); ids.forEach(id=>fbDel("audits",id));
  selAudits.clear(); renderAudit(); toast("Устгалаа");
}
registerScreen("scrRecords", renderRecords);
registerScreen("scrAudit", renderAudit);
