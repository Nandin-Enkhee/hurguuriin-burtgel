/* Ажлын бүртгэл — цалин бодох үндэс.
   Хөргүүрийн үлдэгдэлд огт нөлөөлөхгүй, зөвхөн хэн юуг хэдэн кг хийснийг бүртгэнэ. */
import { db, state, uid, saveLocal } from './state.js';
import { esc, f, int, num, money, isoStr, tsOfIso, dateStr, dayKey, dayKeyOfIso,
         itemName, liveItems, liveWorkers, workerName, payUnitOf, uShort, rateOf,
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
  if(!state.isAdmin && !state.salaryUnlocked){ toast("Энэ хэсэг зөвхөн админд нээлттэй"); return; }
  state.work={ items:{}, worker:null, date:(state.salary.date||isoStr()) };
  const d=$("workDate"); d.value=W().date; d.max=isoStr();
  renderWork(); show("scrWork");
}
export function setWorkDate(v){ W().date = v || isoStr(); renderWorkTotal(); }
onChoose.workw = id => { W().worker=id; renderWork(); };

/* Тогтмол цалинтай хүн хэсгийн тарифаар цалинждаггүй тул энд гарахгүй —
   тэдний ажилласан өдрийг "Ирц тэмдэглэх" хэсгээс бүртгэнэ. */
function pieceWorkers(){ return liveWorkers().filter(w=>w.payType!=="fixed"); }

export function renderWork(){
  $("sel_workw").innerHTML=selectHTML("workw",pieceWorkers(),W().worker,"Ажилчнаа сонгоно уу");
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
    window.openSalary && window.openSalary();
  } finally {
    state.busy.work=false;
    const b=$("workSave"); if(b) b.disabled=false;
  }
}

/* ===================== Тогтмол цалинтай ажилчдын ирц =====================
   Тогтмол цалинтай хүн хэсгийн ажил бүртгүүлдэггүй тул тэдний ажилласан
   өдрийг энд тэмдэглэнэ. Нэг өдөрт олон хүнийг зэрэг чагтална. */
const A = () => state.attend;

function fixedWorkers(){ return liveWorkers().filter(w=>w.payType==="fixed"); }

export function openAttend(){
  if(!requireOnline()) return;
  if(!state.isAdmin && !state.salaryUnlocked){ toast("Энэ хэсэг зөвхөн админд нээлттэй"); return; }
  const d0 = state.salary.date || isoStr();
  state.attend={ date:d0, workers:markedOn(d0) };
  const d=$("attDate"); d.value=A().date; d.max=isoStr();
  renderAttend(); show("scrAttend");
}
/* Тухайн өдөр аль хэдийн тэмдэглэгдсэн хүмүүс */
function markedOn(iso){
  const dk=dayKeyOfIso(iso);
  return (db.attend||[]).filter(x=>dayKey(x.ts)===dk).map(x=>x.worker);
}
export function setAttendDate(v){
  A().date = v || isoStr();
  A().workers = markedOn(A().date);
  renderAttend();
}
export function toggleAttendWorker(id){
  const ws=A().workers, i=ws.indexOf(id);
  if(i>=0) ws.splice(i,1); else ws.push(id);
  renderAttend();
}
export function allAttendWorkers(on){
  A().workers = on ? fixedWorkers().map(w=>w.id) : [];
  renderAttend();
}
export function renderAttend(){
  const ws=fixedWorkers();
  if(!ws.length){
    $("attList").innerHTML=`<div class="empty">Тогтмол цалинтай ажилчин алга.<br>
      Тохиргоо → Ажилчид хэсгээс тэмдэглэнэ үү.</div>`;
    $("attTotal").innerHTML="";
    return;
  }
  $("attList").innerHTML = ws.map(w=>{
    const on=A().workers.indexOf(w.id)>=0;
    return `<div class="pick">
      <button type="button" class="check-row${on?" on":""}" onclick="toggleAttendWorker('${w.id}')">
        <span class="tick">✓</span>
        <span>${esc(w.name)}<small>${money(+w.salary||0)} / өдөр</small></span></button></div>`;
  }).join("");

  const chosen=ws.filter(w=>A().workers.indexOf(w.id)>=0);
  const total=chosen.reduce((s,w)=>s+(+w.salary||0),0);
  $("attTotal").innerHTML = chosen.length
    ? `<div class="tbl-wrap"><table class="tbl" style="min-width:0">
        <thead><tr><th>Ажилчин</th><th class="num">Өдрийн хөлс</th></tr></thead>
        <tbody>${chosen.map(w=>`<tr><td class="nm">${esc(w.name)}</td>
          <td class="amt">${money(+w.salary||0)}</td></tr>`).join("")}
          <tr class="sum"><td>${dateStr(new Date(A().date+"T00:00:00"))} · ${chosen.length} хүн</td>
            <td class="amt">${money(total)}</td></tr>
        </tbody></table></div>`
    : `<div class="empty">Ажилласан хүмүүсээ чагтална уу</div>`;
}
export function saveAttend(){
  if(state.busy.attend) return;
  if(!requireOnline()) return;
  const iso=A().date, dk=dayKeyOfIso(iso);
  const want=A().workers.slice();

  state.busy.attend=true;
  const btn=$("attSave"); if(btn) btn.disabled=true;
  try{
    /* Тухайн өдрийн хуучин тэмдэглэгээг шинээр солино */
    const old=(db.attend||[]).filter(x=>dayKey(x.ts)===dk);
    const removeIds=old.filter(x=>want.indexOf(x.worker)<0).map(x=>x.id);
    const have=old.map(x=>x.worker);
    const addIds=want.filter(w=>have.indexOf(w)<0);

    db.attend=(db.attend||[]).filter(x=>removeIds.indexOf(x.id)<0);
    removeIds.forEach(id=>fbDel("attend",id));

    const ts=tsOfIso(iso), fresh=[];
    addIds.forEach(w=>{
      const rec={id:uid(), ts, worker:w};
      db.attend.push(rec); fresh.push(rec);
    });
    saveLocal();
    fresh.forEach(r=>fbSet("attend",r.id,r));
    toast(`${dateStr(new Date(ts))} · ${want.length} хүн тэмдэглэгдлээ`);
    window.openSalary && window.openSalary();
  } finally {
    state.busy.attend=false;
    const b=$("attSave"); if(b) b.disabled=false;
  }
}
