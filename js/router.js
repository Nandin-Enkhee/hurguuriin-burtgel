const renderers = {};

export function registerScreen(id, render){ renderers[id] = render; }

export function show(id){
  const el=document.getElementById(id);
  /* Дэлгэц олдохгүй бол index.html дутуу шинэчлэгдсэн гэсэн үг.
     Чимээгүй зогсохын оронд шалтгааныг нь хэлнэ. */
  if(!el){
    console.error("Дэлгэц олдсонгүй:",id,"— index.html шинэчлэгдээгүй байж магадгүй");
    const t=document.getElementById("toast");
    if(t){
      t.textContent="Энэ хэсэг ачаалагдаагүй байна · index.html шинэчлэгдээгүй";
      t.classList.add("show");
      setTimeout(()=>t.classList.remove("show"),3000);
    }
    return;
  }
  closeAllSel();
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  el.classList.add("active");
  window.scrollTo(0,0);
}
export function activeScreen(){
  const a=document.querySelector(".screen.active");
  return a ? a.id : null;
}
export function refreshActive(){
  const id=activeScreen();
  const fn=id && renderers[id];
  if(fn) fn();
}
export function closeAllSel(){
  document.querySelectorAll(".sel").forEach(s=>s.classList.remove("open"));
  window.__openSel=null;
}
