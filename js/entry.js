/* Оруулах: бараагаа бүртгээд, ажилчид дээр цалинг нь автоматаар хуваарилна */
import { db, state, uid, saveLocal } from './state.js';
import { esc, f, int, num, isoStr, tsOfIso, itemName, workerName, liveWorkers,
         hasKg, hasPcs, payUnitOf, uShort, rateOf, fridgeName, money } from './util.js';
import { $, toast } from './ui.js';
import { show } from './router.js';
import { registerPicker, renderPicker, blankQty } from './picker.js';
import { fbSet } from './sync.js';
import { openFridge } from './fridge.js';

const E = () => state.entry;

registerPicker("entry",{
  boxId:"entryItems",
  sel: () => E().items,
  fridge: () => state.curFridge,
  lineHTML: id => sackLine(id),
  onChange: () => { recalcSplit(); renderCalc(); }
});
function sackLine(id){
  const v=E().items[id]||{};
  const t=int(v.per)*int(v.sacks);
  if(!v.per && !v.sacks) return "";
  return t>0 ? "= "+t+" ширхэг" : "Шуудайн тоогоо бичнэ үү";
}

export function openEntry(){
  state.entry={ items:{}, workers:[], split:{}, date:isoStr() };
  $("enTitle").textContent="Оруулах · "+fridgeName(state.curFridge);
  const d=$("enDate"); d.value=E().date; d.max=isoStr();
  renderPicker("entry"); renderEntryWorkers(); renderCalc();
  show("scrEntry");
}
export function setEntryDate(v){ E().date = v || isoStr(); }

export function renderEntryWorkers(){
  const ws=liveWorkers();
  $("entryWorkers").innerHTML = ws.length ? ws.map(w=>{
    const on=E().workers.indexOf(w.id)>=0;
    const tag = w.payType==="fixed" ? ` <small>тогтмол цалинтай</small>` : "";
    return `<div class="pick">
      <button type="button" class="check-row${on?" on":""}" onclick="toggleEntryWorker('${w.id}')">
        <span class="tick">✓</span><span>${esc(w.name)}${tag}</span></button></div>`;
  }).join("") : `<div class="empty">Ажилчин бүртгээгүй байна.<br>Тохиргоо → Ажилчид хэсгээс нэмнэ үү.</div>`;
}
export function toggleEntryWorker(id){
  const ws=E().workers, i=ws.indexOf(id);
  if(i>=0) ws.splice(i,1); else ws.push(id);
  renderEntryWorkers(); recalcSplit(); renderCalc();
}
export function allEntryWorkers(on){
  state.entry.workers = on ? liveWorkers().map(w=>w.id) : [];
  renderEntryWorkers(); recalcSplit(); renderCalc();
}

/* Нийт хэмжээг ажилчдын тоонд тэнцүү хуваана. Үлдэгдэл нь эхний хүнд очно. */
export function recalcSplit(){
  const e=E();
  e.split={};
  const n=e.workers.length;
  if(!n) return;
  e.workers.forEach(w=>e.split[w]={});
  Object.keys(e.items).forEach(iid=>{
    const q=e.items[iid];
    const tKg=f(q.kg), tPcs=int(q.pcs);
    const eachKg=num(tKg/n), baseP=Math.floor(tPcs/n), rem=tPcs-baseP*n;
    e.workers.forEach((w,idx)=>{
      e.split[w][iid]={
        kg: idx===0 ? num(tKg-eachKg*(n-1)) : eachKg,
        pcs: baseP + (idx<rem?1:0)
      };
    });
  });
}
function cell(w,iid){
  const e=E();
  e.split[w]=e.split[w]||{};
  e.split[w][iid]=e.split[w][iid]||{kg:0,pcs:0};
  return e.split[w][iid];
}
function workerSum(w){
  const row=E().split[w]||{};
  return Object.keys(row).reduce((s,iid)=>s+f(row[iid][payUnitOf(iid)])*rateOf(w,iid),0);
}

export function renderCalc(){
  const e=E(), box=$("entryCalc");
  const iids=Object.keys(e.items);
  if(!e.workers.length || !iids.length){
    box.innerHTML=`<div class="empty">Бараа болон ажилчнаа сонгоход тооцоо энд гарна</div>`;
    return;
  }
  let grand=0;
  let h=e.workers.map(w=>{
    const wk=db.workers.find(x=>x.id===w)||{};
    const s=workerSum(w); grand+=s;
    const head = wk.payType==="fixed" ? "тогтмол" : money(s);
    return `<div class="calc-w">
      <div class="calc-head"><span>${esc(workerName(w))}</span><b id="ws_${w}">${head}</b></div>
      ${iids.map(iid=>{
        const u=payUnitOf(iid);
        return `<div class="calc-row"><span class="cn">${esc(itemName(iid))}</span>
          <input type="number" inputmode="${u==="pcs"?"numeric":"decimal"}" min="0" step="${u==="pcs"?"1":"0.01"}"
                 value="${cell(w,iid)[u]}" oninput="setManual('${w}','${iid}',this.value)">
          <span class="cu">${uShort(u)}</span></div>`;
      }).join("")}
    </div>`;
  }).join("");
  h+=`<div class="total-line"><span>Нийт цалин</span><b id="calcTotal">${money(grand)}</b></div>`;
  box.innerHTML=h;
}
export function setManual(w,iid,v){
  const u=payUnitOf(iid);
  cell(w,iid)[u] = u==="pcs" ? int(v) : f(v);
  let grand=0;
  E().workers.forEach(x=>{
    const wk=db.workers.find(y=>y.id===x)||{};
    const s=workerSum(x); grand+=s;
    const el=$("ws_"+x);
    if(el) el.textContent = wk.payType==="fixed" ? "тогтмол" : money(s);
  });
  const t=$("calcTotal"); if(t) t.textContent=money(grand);
}

export function saveEntry(){
  if(state.busy.entry) return;
  const e=E();
  const iids=Object.keys(e.items).filter(id=>f(e.items[id].kg)>0||int(e.items[id].pcs)>0);
  if(!iids.length){ toast("Бараа болон хэмжээг нь оруулна уу"); return; }
  if(!e.workers.length){ toast("Ажилчнаа сонгоно уу"); return; }

  state.busy.entry=true;
  const btn=$("entrySave"); if(btn) btn.disabled=true;
  try{
    const ts=tsOfIso(e.date), fresh=[];
    iids.forEach(iid=>{
      e.workers.forEach(w=>{
        const c=cell(w,iid);
        const kg  = hasKg(iid)  ? num(f(c.kg)) : 0;
        const pcs = hasPcs(iid) ? int(c.pcs)   : 0;
        if(kg<=0 && pcs<=0) return;
        const rec={id:uid(),ts,fridge:state.curFridge,item:iid,worker:w,
                   action:"in",kg,pcs,receipt:null,purchase:null};
        db.log.push(rec); fresh.push(rec);
      });
    });
    saveLocal();
    fresh.forEach(r=>fbSet("log",r.id,r));
    toast("Бүртгэл хадгалагдлаа");
    openFridge(state.curFridge);
  } finally {
    state.busy.entry=false;
    const b=$("entrySave"); if(b) b.disabled=false;
  }
}
