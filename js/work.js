/* Ажлын бүртгэл — цалин бодох үндэс.
   Хөргүүрийн үлдэгдэлд огт нөлөөлөхгүй, зөвхөн хэн юуг хэдэн кг хийснийг бүртгэнэ. */
import { db, state, uid, saveLocal } from './state.js';
import { esc, f, int, num, money, isoStr, tsOfIso, dateStr, itemName,
         liveItems, liveWorkers, workerName, payUnitOf, uShort, rateOf,
         hasKg, hasPcs, qtyFor, payFor } from './util.js';
import { $, toast, selectHTML, onChoose } from './ui.js';
import { show } from './router.js';
import { registerPicker, renderPicker } from './picker.js';
import { fbSet, fbDel } from './sync.js';
import { requireOnline } from './auth.js';

const W = () => state.work;

registerPicker("work",{
  boxId:"workItems",
  sel: () => W().items,
  fridge: () => state.curFridge,
  items: () => liveItems(),          /* бүх ангилал — хөргүүрээс хамаарахгүй */
  lineHTML: id => lineText(id),
  onChange: () => renderWorkTotal()
});

export function openWork(){
  if(!requireOnline()) return;
  if(!state.isAdmin){ toast("Энэ хэсэг зөвхөн админд нээлттэй"); return; }
  state.work={ items:{}, worker:null, date:(state.salary.date||isoStr()) };
  const d=$("workDate"); d.value=W().date; d.max=isoStr();
  renderWork(); show("scrWork");
}
export function setWorkDate(v){ W().date = v || isoStr(); renderWorkTotal(); }
onChoose.workw = id => { W().worker=id; renderWork(); };

export function renderWork(){
  $("sel_workw").innerHTML=selectHTML("workw",liveWorkers(),W().worker,"Ажилчнаа сонгоно уу");
  renderPicker("work");
  renderWorkTotal();
}
function qtyOf(id){
  const v=W().items[id]||{};
  return payUnitOf(id)==="pcs" ? int(v.pcs) : f(v.kg);
}
function lineText(id){
  const q=qtyOf(id), r=W().worker ? rateOf(W().worker,id) : 0;
  if(q<=0) return W().worker ? `Тариф: ${money(r)} / ${uShort(payUnitOf(id))}` : "Ажилчнаа сонгоно уу";
  return `${num(q)} ${uShort(payUnitOf(id))} × ${money(r)} = ${money(q*r)}`;
}
export function renderWorkTotal(){
  const w=W().worker;
  const ids=Object.keys(W().items).filter(id=>qtyOf(id)>0);
  if(!w || !ids.length){
    $("workTotal").innerHTML=`<div class="empty">Ажилчин, бараагаа сонгоход тооцоо энд гарна</div>`;
    return;
  }
  let total=0;
  const rows=ids.map(id=>{
    const q=qtyOf(id), r=rateOf(w,id), amt=q*r;
    total+=amt;
    return `<tr><td class="nm">${esc(itemName(id))}</td>
      <td class="num">${num(q)} ${uShort(payUnitOf(id))}</td>
      <td class="num dim">${money(r)}</td>
      <td class="amt">${money(amt)}</td></tr>`;
  }).join("");
  $("workTotal").innerHTML=`<div class="tbl-wrap"><table class="tbl" style="min-width:330px">
      <thead><tr><th>Бараа</th><th class="num">Хэмжээ</th><th class="num">Тариф</th><th class="num">Дүн</th></tr></thead>
      <tbody>${rows}
        <tr class="sum"><td colspan="3">${dateStr(new Date(W().date+"T00:00:00"))} · нийт</td>
          <td class="amt">${money(total)}</td></tr>
      </tbody></table></div>`;
}

export function saveWork(){
  if(state.busy.work) return;
  if(!requireOnline()) return;
  const w=W().worker;
  const ids=Object.keys(W().items).filter(id=>qtyOf(id)>0);
  if(!w){ toast("Ажилчнаа сонгоно уу"); return; }
  if(!ids.length){ toast("Бараа болон хэмжээг нь оруулна уу"); return; }

  state.busy.work=true;
  const btn=$("workSave"); if(btn) btn.disabled=true;
  try{
    const ts=tsOfIso(W().date), fresh=[];
    ids.forEach(id=>{
      const v=W().items[id];
      const rec={ id:uid(), ts, worker:w, item:id,
                  kg: hasKg(id)?num(f(v.kg)):0,
                  pcs: hasPcs(id)?int(v.pcs):0 };
      db.works.push(rec); fresh.push(rec);
    });
    saveLocal();
    fresh.forEach(r=>fbSet("works",r.id,r));
    const total=fresh.reduce((s,r)=>s+payFor(r),0);
    toast(`${workerName(w)} · ${money(total)} бүртгэгдлээ`);
    show("scrSalary");
    window.renderSalary && window.renderSalary();
  } finally {
    state.busy.work=false;
    const b=$("workSave"); if(b) b.disabled=false;
  }
}
export function delWork(id){
  if(!requireOnline()) return;
  if(!confirm("Энэ ажлын бүртгэлийг устгах уу?")) return;
  db.works=db.works.filter(x=>x.id!==id);
  saveLocal(); fbDel("works",id);
  window.renderSalary && window.renderSalary();
  toast("Устгалаа");
}
