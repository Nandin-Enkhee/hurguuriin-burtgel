/* Төлбөрийн баримт — 2 хувь хэвлэгдэнэ.
   Хувь хүнд олгосон бол шилжүүлэх дансны мэдээлэл хамт гарна. */
import { db, state } from './state.js';
import { esc, isoStr, timeStr, money, lQty, lUnit, workerName, uShort } from './util.js';
import { $ } from './ui.js';
import { show } from './router.js';
import { goHome } from './auth.js';

const STARS="*".repeat(34);

function receiptHTML(rc, copyLabel, cls){
  const c=db.company||{};
  let h=`<div class="receipt ${cls}">`;
  h+=`<div class="ctr stars">${STARS}</div>`;
  h+=`<div class="ctr co">${esc(c.name||"")}</div>`;
  if(c.phone) h+=`<div class="ctr">Утас: ${esc(c.phone)}</div>`;
  if(c.reg)   h+=`<div class="ctr">Регистр: ${esc(c.reg)}</div>`;
  h+=`<div class="ctr copy">${copyLabel}</div>`;
  h+=`<div class="ctr stars">${STARS}</div>`;
  h+=`<div><b>Баримтын дугаар:</b> БАР-${rc.no}</div>`;
  h+=`<div><b>Огноо:</b> ${isoStr(new Date(rc.ts))} ${timeStr(new Date(rc.ts))}</div>`;
  h+=`<div><b>${rc.buyer.type==="org"?"Хүлээн авагч байгууллага":"Хүлээн авагч"}:</b><br>${esc(rc.buyer.name)}</div>`;
  if(rc.buyer.reg)   h+=`<div><b>Регистр:</b> ${esc(rc.buyer.reg)}</div>`;
  if(rc.buyer.phone) h+=`<div><b>Утас:</b> ${esc(rc.buyer.phone)}</div>`;
  if(rc.editedTs)    h+=`<div>Засварласан: ${isoStr(new Date(rc.editedTs))} ${timeStr(new Date(rc.editedTs))}</div>`;
  h+=`<div class="ln"></div>`;
  rc.lines.forEach(l=>{
    const q=lQty(l), u=lUnit(l);
    let qtxt = u==="pcs" ? `${q} ширхэг` : `${q.toFixed(2)} кг${l.pcs?` (${l.pcs} ш)`:""}`;
    if(l.sacks) qtxt = `${l.sacks} шуудай × ${l.perSack} ш = ${q} ширхэг`;
    h+=`<div><b>${esc(l.name)}:</b> ${qtxt} × ${money(l.price)}<br>= ${money(q*l.price)}</div>`;
  });
  h+=`<div class="ln"></div>`;
  h+=`<div class="big">Нийт дүн: ${money(rc.total)}</div>`;

  /* Хувь хүн мөнгөө шилжүүлэх боломжтой байх ёстой */
  if(rc.buyer.type==="person" && c.account){
    h+=`<div class="bank"><div><b>Мөнгө шилжүүлэх данс</b></div>`;
    if(c.bank)        h+=`<div>${esc(c.bank)}</div>`;
    h+=`<div>${esc(c.account)}</div>`;
    if(c.accountName) h+=`<div>${esc(c.accountName)}</div>`;
    h+=`</div>`;
  }
  h+=`<div class="sig"><div>Хүлээн авагчийн гарын үсэг:</div><div class="sig-line"></div>`;
  h+=`<div><b>Олгосон ажилтан:</b> ${esc(workerName(rc.issuer))}</div></div>`;
  h+=`<div class="ctr stars">${STARS}</div></div>`;
  return h;
}

export function drawReceipt(rc){
  state.receipt.current=rc.id;
  $("rcBody").innerHTML = receiptHTML(rc,"Компанид үлдэх","copy1")
                        + receiptHTML(rc,"Хүлээн авагчид өгөх","copy2");
  show("scrReceipt");
}
export function closeReceipt(){ goHome(); }
export function printReceipt(){ window.print(); }
export function openOneReceipt(id){
  const rc=db.receipts.find(x=>x.id===id);
  if(!rc) return;
  state.curFridge=rc.fridge;
  drawReceipt(rc);
}
