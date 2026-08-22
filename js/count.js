/* Тоолох — ангилал сонгоод хэдэн ширхэг/боодлыг эгнүүлж тоолоод нийлбэрийг
   хадгална. Тоо бичээд Enter дархад дараагийн мөр өөрөө нээгдэнэ.
   Хөргүүрийн үлдэгдэлд нөлөөлөхгүй, зөвхөн тооллогын түүхэнд бичигдэнэ.
   Ажилчин, админ хоёул хандах эрхтэй. */
import { db, state, uid, saveLocal } from './state.js';
import { esc, f, num, dateStr, timeStr, itemName, liveItems } from './util.js';
import { $, toast } from './ui.js';
import { show, registerScreen } from './router.js';
import { fbSet, fbDel } from './sync.js';
import { requireOnline } from './auth.js';

const CN = () => state.count;

/* Хадгалаагүйгээр буцсан тооллого — ангилал тус бүрээр түр санахад.
   Зөвхөн энэ нэвтрэлтийн хугацаанд амьдрах бөгөөд Хадгалах дарахад,
   эсвэл бүх тоо хоосорвол устана. */
const drafts = {};
function syncDraft(){
  const c=CN();
  if(!c.item) return;
  if(c.editId) return;   /* хуучин бичилтийг засаж байхад шинэ ноорог үүсгэхгүй */
  if(c.vals.some(v=>f(v)>0)) drafts[c.item]=c.vals.slice();
  else delete drafts[c.item];
}

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
      <span class="item-val">${drafts[it.id]?`<span class="pill pill-due">Тоолж байна</span> `:""}›</span>
    </div>`).join("")
    : `<div class="empty">Бараа нэмээгүй байна.<br>Тохиргоо → Бараа, үнэ хэсгээс нэмнэ үү.</div>`;
}
registerScreen("scrCount", renderCountList);

/* ---------- Тоолох дэлгэц ---------- */
export function openCountItem(id){
  const d=drafts[id];
  state.count={ item:id, vals: d ? d.slice() : [""], editId:null };
  renderCountEntry();
  show("scrCountEntry");
}
export function renderCountEntry(){
  const c=CN();
  if(!c.item){ show("scrCount"); return; }
  $("cntTitle").textContent = (c.editId?"Засах · ":"Тоолох · ")+itemName(c.item);
  renderCountRows();
  renderCountTotal();
  renderCountHist();
}
registerScreen("scrCountEntry", renderCountEntry);

export function renderCountRows(){
  const c=CN();
  $("cntRows").innerHTML = c.vals.map((v,i)=>`
    <div class="cnt-cell">
      <input type="number" inputmode="decimal" enterkeyhint="next" value="${esc(v)}"
             oninput="setCountVal(${i},this.value)" onkeydown="countKeydown(${i},event)">
      ${c.vals.length>1 ? `<button type="button" class="cnt-del" onclick="removeCountRow(${i})">✕</button>` : ""}
    </div>`).join("");
}
export function addCountRow(){
  CN().vals.push("");
  renderCountRows();
  renderCountTotal();
  const box=$("cntRows");
  const inputs=box ? box.querySelectorAll("input") : [];
  const last=inputs[inputs.length-1];
  if(last) last.focus();
  if(box) box.scrollTop=box.scrollHeight;
}
export function removeCountRow(i){
  const c=CN();
  if(c.vals.length<=1) return;
  c.vals.splice(i,1);
  renderCountRows();
  renderCountTotal();
  syncDraft();
}
export function setCountVal(i,v){
  CN().vals[i]=v;
  renderCountTotal();
  syncDraft();
}
/* Тоогоо бичээд Enter дархад: сүүлийн мөр дээр бөгөөд утгатай бол
   шинэ мөр нэмээд шууд идэвхжүүлнэ — гараар "+ Тоо нэмэх" дарах шаардлагагүй. */
export function countKeydown(i,ev){
  if(ev.key!=="Enter") return;
  const c=CN();
  if(i!==c.vals.length-1) return;   /* зөвхөн сүүлийн мөрөнд ажиллана */
  if(f(c.vals[i])<=0) return;       /* хоосон бол энгийн Enter — гар хаагдана */
  ev.preventDefault();
  ev.stopPropagation();
  addCountRow();
}

function countTotal(){ return CN().vals.reduce((s,v)=>s+f(v),0); }
export function renderCountTotal(){
  const has=CN().vals.some(v=>f(v)>0);
  $("cntTotal").innerHTML = has
    ? `<div class="count-total">Нийт= ${num(countTotal())}</div>`
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
        <small>${esc((x.entries||[]).join(" + "))}${x.note?" · ("+esc(x.note)+")":""}</small></span>
      <span class="item-val">${num(x.total)}
        <button class="icon-btn pri" style="padding:5px 9px;font-size:13px;margin-left:6px"
                onclick="editCount('${x.id}')">Засах</button>
        <button class="icon-btn moss" style="padding:5px 9px;font-size:13px;margin-left:4px"
                onclick="redoCount()">Дахин бодох</button>
        <button class="icon-btn" style="padding:5px 9px;font-size:13px;margin-left:4px"
                onclick="delCount('${x.id}')">✕</button></span>
    </div>`).join("") : `<div class="empty">Өмнөх тооллого алга</div>`;
}

/* Хуучин бичсэн тооллогыг яг тэр тоонуудаар нь ачааллаж засварлана.
   Хадгалахад шинэ бичилт үүсгэхгүй, яг энэ бичилтийг дарж бичнэ. */
export function editCount(id){
  const rec=(db.counts||[]).find(x=>x.id===id);
  if(!rec) return;
  state.count={ item:rec.item, vals: rec.entries && rec.entries.length ? rec.entries.map(String) : [""], editId:rec.id };
  renderCountEntry();
}
/* Одоогийн бичиж буй тоонуудыг цэвэрлэж, засварын горимыг цуцлаад
   эхнээс нь дахин тоолуулна. */
export function redoCount(){
  const c=CN();
  state.count={ item:c.item, vals:[""], editId:null };
  renderCountEntry();
  const box=$("cntRows");
  const first=box ? box.querySelector("input") : null;
  if(first) first.focus();
}

/* ---------- Хадгалах ---------- */
export function saveCount(){
  if(state.busy.count) return;
  if(!requireOnline()) return;
  const c=CN();
  if(!c.item){ toast("Ангилалаа сонгоно уу"); return; }
  const nums=c.vals.map(f).filter(n=>n>0);
  if(!nums.length){ toast("Тоолсон тоогоо оруулна уу"); return; }

  const note=(prompt("Тайлбар нэмэх үү? (заавал биш)","")||"").trim();

  state.busy.count=true;
  const btn=$("cntSave"); if(btn) btn.disabled=true;
  try{
    if(c.editId){
      const rec=(db.counts||[]).find(x=>x.id===c.editId);
      if(!rec){ toast("Бичилт олдсонгүй"); return; }
      rec.entries=nums.map(num);
      rec.total=num(nums.reduce((s,n)=>s+n,0));
      rec.note=note;
      saveLocal();
      fbSet("counts",rec.id,rec);
      toast("Тооллого засагдлаа · "+num(rec.total));
    }else{
      const rec={ id:uid(), ts:Date.now(), item:c.item,
                  entries:nums.map(num), total:num(nums.reduce((s,n)=>s+n,0)),
                  note };
      db.counts.push(rec);
      saveLocal();
      fbSet("counts",rec.id,rec);
      toast("Тооллого хадгалагдлаа · "+num(rec.total));
    }
    delete drafts[c.item];
    state.count={ item:c.item, vals:[""], editId:null };
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
  /* Устгасан бичилтийг яг одоо засварлаж байсан бол горимыг цуцална */
  if(CN().editId===id){ state.count={ item:CN().item, vals:[""], editId:null }; renderCountEntry(); return; }
  renderCountHist();
}
