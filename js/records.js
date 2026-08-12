/* Баримт, түүх ба засварын түүх */
import { db, state, saveLocal } from './state.js';
import { esc, dateStr, timeStr, itemName, workerName, qtyLine, money, fridgeName } from './util.js';
import { $, toast } from './ui.js';
import { show, registerScreen } from './router.js';
import { fbDel } from './sync.js';

const selLogs=new Set(), selAudits=new Set();

export function openRecords(){
  if(!state.isAdmin){ toast("Энэ хэсэг зөвхөн админд нээлттэй"); return; }
  selLogs.clear(); renderRecords(); show("scrRecords");
}
export function toggleLogSel(id){
  selLogs.has(id) ? selLogs.delete(id) : selLogs.add(id);
  renderRecords();
}
function logLabel(e){
  if(e.action==="out") return {t:"Зарлага",c:"var(--rust)"};
  if(e.purchase)      return {t:"Худалдан авсан",c:"var(--moss)"};
  return {t:"Орлого",c:"var(--blue)"};
}
export function renderRecords(){
  const items=db.log.slice().sort((a,b)=>b.ts-a.ts).slice(0,100);
  $("recList").innerHTML = items.length ? items.map(e=>{
    const d=new Date(e.ts), on=selLogs.has(e.id), lb=logLabel(e);
    const who=e.worker?" · "+workerName(e.worker):"";
    return `<div class="pick" style="display:flex;align-items:center;gap:6px">
      <button type="button" class="check-row${on?" on":""}" style="flex:1" onclick="toggleLogSel('${e.id}')">
        <span class="tick">✓</span>
        <span><b style="color:${lb.c}">${lb.t}</b> ${esc(itemName(e.item))} ${qtyLine(e.kg,e.pcs,e.item)}
          <small>${dateStr(d)} ${timeStr(d)} · ${esc(fridgeName(e.fridge)+who)}</small></span></button>
      ${e.receipt?`<button class="icon-btn pri" onclick="openOneReceipt('${e.receipt}')">Баримт</button>`:""}
    </div>`;
  }).join("") : `<div class="empty">Бүртгэл хийгдээгүй байна</div>`;
}
export function deleteSelectedLogs(){
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

export function openAudit(){
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
  if(!selAudits.size){ toast("Устгах мөрөө чагтална уу"); return; }
  if(!confirm(`${selAudits.size} бүртгэлийг устгах уу?`)) return;
  const ids=Array.from(selAudits);
  db.audits=(db.audits||[]).filter(a=>ids.indexOf(a.id)<0);
  saveLocal(); ids.forEach(id=>fbDel("audits",id));
  selAudits.clear(); renderAudit(); toast("Устгалаа");
}
registerScreen("scrRecords", renderRecords);
registerScreen("scrAudit", renderAudit);
