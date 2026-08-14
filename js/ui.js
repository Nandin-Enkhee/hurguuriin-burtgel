/* Дахин ашиглагддаг UI хэсгүүд: мэдэгдэл, доош унждаг сонголт. */
import { esc } from './util.js';
import { closeAllSel } from './router.js';

export const $ = id => document.getElementById(id);

let toastTimer=null;
export function toast(msg){
  const t=$("toast");
  t.textContent=msg; t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove("show"),2400);
}

/* --- Доош унждаг сонголт ---
   Бүх дуудлага ижил хэлбэртэй: selectHTML(нэр, сонголтууд, одоогийн, чиглүүлэг)
   Сонголт хийхэд onChoose[нэр] дуудагдана. */
export const onChoose = {};

export function selectHTML(name, options, curId, placeholder){
  const cur=options.find(o=>o.id===curId);
  const opts = options.length
    ? options.map(o=>`
        <button type="button" class="sel-opt${o.id===curId?" on":""}" onclick="chooseSel('${name}','${o.id}')">
          <span class="tick">✓</span><span>${esc(o.name)}</span>
        </button>`).join("")
    : `<div class="empty">Жагсаалт хоосон байна</div>`;
  return `
    <button type="button" class="sel-head${cur?"":" ph"}" onclick="toggleSel('${name}')">
      <span class="sel-val">${cur?esc(cur.name):placeholder}</span><span class="caret">▼</span>
    </button>
    <div class="sel-body">${opts}</div>`;
}

export function toggleSel(name){
  const el=$("sel_"+name);
  const was=el.classList.contains("open");
  closeAllSel();
  if(!was){ el.classList.add("open"); window.__openSel=name; }
}
export function chooseSel(name,id){
  closeAllSel();
  const fn=onChoose[name];
  if(fn) fn(id);
}

/* Гадна талд дархад нээлттэй сонголтыг хаана */
document.addEventListener("click", e=>{
  if(window.__openSel && e.target.closest && !e.target.closest(".sel")) closeAllSel();
});

/* Байгууллага сонгох нийтлэг жагсаалт — Гаргах, Худалдан авах хоёрт ижил */
export function orgOptions(partners){
  return [{id:"__person",name:"Хувь хүн"}]
    .concat(partners.map(p=>({id:p.id,name:p.name})))
    .concat([{id:"__addorg",name:"＋ Шинэ байгууллага нэмэх"}]);
}
