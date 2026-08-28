/* Оруулах — зөвхөн хөргүүрийн үлдэгдэлд нөлөөлнө.
   Цалин энд бодогдохгүй; хэн хянаж оруулсныг л тэмдэглэнэ. */
import { db, state, uid, saveLocal } from './state.js';
import { esc, f, int, num, isoStr, tsOfIso, itemName, hasKg, hasPcs,
         fridgeName, liveWorkers, qtyLine } from './util.js';
import { $, toast, selectHTML, onChoose } from './ui.js';
import { show } from './router.js';
import { registerPicker, renderPicker } from './picker.js';
import { fbSet, save } from './sync.js';
import { openFridge } from './fridge.js';
import { requireOnline } from './auth.js';

const E = () => state.entry;

registerPicker("entry",{
  boxId:"entryItems",
  sel: () => E().items,
  fridge: () => state.curFridge,
  lineHTML: id => sackLine(id),
  onChange: () => renderEntrySummary()
});
function sackLine(id){
  const v=E().items[id]||{};
  if(!v.per && !v.sacks) return "";
  const t=int(v.per)*int(v.sacks);
  return t>0 ? "= "+t+" ширхэг" : "Шуудайн тоогоо бичнэ үү";
}

export function openEntry(){
  if(!requireOnline()) return;
  const known = db.lastRecorder && liveWorkers().some(w=>w.id===db.lastRecorder) ? db.lastRecorder : null;
  state.entry={ items:{}, recorder:known, date:isoStr() };
  $("enTitle").textContent="Оруулах · "+fridgeName(state.curFridge);
  const d=$("enDate"); d.value=E().date; d.max=isoStr();
  renderEntry(); show("scrEntry");
}
export function setEntryDate(v){ E().date = v || isoStr(); }

onChoose.recorder = id => { E().recorder=id; db.lastRecorder=id; save(); renderEntry(); };

export function renderEntry(){
  $("sel_recorder").innerHTML=selectHTML("recorder",liveWorkers(),E().recorder,"Хянасан хүнээ сонгоно уу");
  renderPicker("entry");
  renderEntrySummary();
}
export function renderEntrySummary(){
  const ids=Object.keys(E().items).filter(id=>f(E().items[id].kg)>0||int(E().items[id].pcs)>0);
  $("entrySummary").innerHTML = ids.length
    ? `<div class="tbl-wrap"><table class="tbl" style="min-width:0">
        <thead><tr><th>Бараа</th><th class="num">Хэмжээ</th></tr></thead>
        <tbody>${ids.map(id=>{
          const v=E().items[id];
          return `<tr><td class="nm">${esc(itemName(id))}</td>
            <td class="amt">${qtyLine(f(v.kg),int(v.pcs),id)}</td></tr>`;
        }).join("")}</tbody></table></div>`
    : `<div class="empty">Бараагаа сонгоод хэмжээг нь бичнэ үү</div>`;
}

export function saveEntry(){
  if(state.busy.entry) return;
  if(!requireOnline()) return;
  const e=E();
  const ids=Object.keys(e.items).filter(id=>f(e.items[id].kg)>0||int(e.items[id].pcs)>0);
  if(!ids.length){ toast("Бараа болон хэмжээг нь оруулна уу"); return; }
  if(!e.recorder){ toast("Хянаж оруулсан хүнээ сонгоно уу"); return; }

  state.busy.entry=true;
  const btn=$("entrySave"); if(btn) btn.disabled=true;
  try{
    const ts=tsOfIso(e.date), fresh=[];
    ids.forEach(id=>{
      const v=e.items[id];
      const kg  = hasKg(id)  ? num(f(v.kg)) : 0;
      const pcs = hasPcs(id) ? int(v.pcs)   : 0;
      if(kg<=0 && pcs<=0) return;
      const rec={id:uid(),ts,fridge:state.curFridge,item:id,
                 worker:null, by:e.recorder,          /* by = хянаж оруулсан хүн */
                 action:"in",kg,pcs,receipt:null,purchase:null};
      db.log.push(rec); fresh.push(rec);
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
