/* Тоолох — ангилал сонгоод хэдэн ширхэг/боодлыг эгнүүлж тоолоод нийлбэрийг
   тайлбарын хамт хадгална. Хөргүүрийн үлдэгдэлд нөлөөлөхгүй, зөвхөн
   тооллогын түүхэнд бичигдэнэ. Ажилчин, админ хоёул хандах эрхтэй. */
import { db, state, uid, saveLocal } from './state.js';
import { esc, f, num, dateStr, timeStr, itemName, liveItems } from './util.js';
import { $, toast } from './ui.js';
import { show, registerScreen } from './router.js';
import { fbSet, fbDel } from './sync.js';
import { requireOnline } from './auth.js';

const CN = () => state.count;

/* ---------- Ангилал сонгох жагсаалт ---------- */
export function openCount(){
  if(!requireOnline()) return;
  renderCountList();
  show("scrCount");
}
export function renderCountList(){
  const box=$("countList");
  if(!box) return;
  const items=liveItems();
  box.innerHTML = items.length ? items.map(it=>`
    <div class="item-row" style="cursor:pointer" onclick="openCountItem('${it.id}')">
      <span class="item-name">${esc(it.name)}</span>
      <span class="item-val">›</span>
    </div>`).join("")
    : `<div class="empty">Бараа нэмээгүй байна.<br>Тохиргоо → Бараа, үнэ хэсгээс нэмнэ үү.</div>`;
}
registerScreen("scrCount", renderCountList);

/* ---------- Тоолох дэлгэц ---------- */
export function openCountItem(id){
  state.count={ item:id, vals:[""], note:"" };
  renderCountEntry();
  show("scrCountEntry");
}
export function renderCountEntry(){
  const c=CN();
  if(!c.item){ show("scrCount"); return; }
  $("cntTitle").textContent="Тоолох · "+itemName(c.item);
  renderCountRows();
  renderCountTotal();
  const noteEl=$("cntNote"); if(noteEl) noteEl.value=c.note||"";
  renderCountHist();
}
registerScreen("scrCountEntry", renderCountEntry);

export function renderCountRows(){
  const c=CN();
  $("cntRows").innerHTML = c.vals.map((v,i)=>`
    <div class="edit-row">
      <input type="number" inputmode="decimal" placeholder="Тоо" value="${esc(v)}"
             oninput="setCountVal(${i},this.value)">
      ${c.vals.length>1 ? `<button class="icon-btn" onclick="removeCountRow(${i})">✕</button>` : ""}
    </div>`).join("");
}
export function addCountRow(){
  CN().vals.push("");
  renderCountRows();
  renderCountTotal();
  const inputs=$("cntRows").querySelectorAll("input");
  const last=inputs[inputs.length-1];
  if(last) last.focus();
}
export function removeCountRow(i){
  const c=CN();
  if(c.vals.length<=1) return;
  c.vals.splice(i,1);
  renderCountRows();
  renderCountTotal();
}
export function setCountVal(i,v){
  CN().vals[i]=v;
  renderCountTotal();
}
export function setCountNote(v){ CN().note=v; }

function countTotal(){ return CN().vals.reduce((s,v)=>s+f(v),0); }
export function renderCountTotal(){
  const nums=CN().vals.filter(v=>f(v)>0);
  $("cntTotal").innerHTML = nums.length
    ? `<div class="total-line"><span>${nums.map(v=>num(f(v))).join(" + ")}</span><b>${num(countTotal())}</b></div>`
    : `<div class="empty">Тоолсон тоогоо оруулна уу</div>`;
}

/* ---------- Өмнөх тооллого ---------- */
function pastCounts(id){
  return (db.counts||[]).filter(x=>x.item===id).sort((a,b)=>b.ts-a.ts).slice(0,10);
}
export function renderCountHist(){
  const box=$("cntHist");
  if(!box) return;
  const list=pastCounts(CN().item);
  box.innerHTML = list.length ? list.map(x=>`
    <div class="item-row">
      <span class="item-name">${dateStr(new Date(x.ts))} ${timeStr(new Date(x.ts))}
        <small>${esc((x.entries||[]).join(" + "))}${x.note?" · "+esc(x.note):""}</small></span>
      <span class="item-val">${num(x.total)}
        <button class="icon-btn" style="padding:5px 9px;font-size:13px;margin-left:6px"
                onclick="delCount('${x.id}')">✕</button></span>
    </div>`).join("") : `<div class="empty">Өмнөх тооллого алга</div>`;
}

/* ---------- Хадгалах ---------- */
export function saveCount(){
  if(state.busy.count) return;
  if(!requireOnline()) return;
  const c=CN();
  if(!c.item){ toast("Ангилалаа сонгоно уу"); return; }
  const nums=c.vals.map(f).filter(n=>n>0);
  if(!nums.length){ toast("Тоолсон тоогоо оруулна уу"); return; }

  state.busy.count=true;
  const btn=$("cntSave"); if(btn) btn.disabled=true;
  try{
    const rec={ id:uid(), ts:Date.now(), item:c.item,
                entries:nums.map(num), total:num(nums.reduce((s,n)=>s+n,0)),
                note:(c.note||"").trim() };
    db.counts.push(rec);
    saveLocal();
    fbSet("counts",rec.id,rec);
    toast("Тооллого хадгалагдлаа · "+num(rec.total));
    state.count={ item:c.item, vals:[""], note:"" };
    renderCountEntry();
  } finally {
    state.busy.count=false;
    const b=$("cntSave"); if(b) b.disabled=false;
  }
}
export function delCount(id){
  if(!requireOnline()) return;
  if(!confirm("Энэ тооллогыг устгах уу?")) return;
  db.counts=(db.counts||[]).filter(x=>x.id!==id);
  saveLocal(); fbDel("counts",id);
  renderCountHist();
  toast("Устгалаа");
}
