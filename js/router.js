/* Дэлгэц солих ба дахин зурах нэг цэг.
   Дэлгэц бүр өөрийгөө бүртгүүлнэ — if/else гинж хэрэггүй. */
const renderers = {};

export function registerScreen(id, render){ renderers[id] = render; }

export function show(id){
  closeAllSel();
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  const el=document.getElementById(id);
  if(el) el.classList.add("active");
  window.scrollTo(0,0);
}
export function activeScreen(){
  const a=document.querySelector(".screen.active");
  return a ? a.id : null;
}
/* Сервер талаас өгөгдөл ирэхэд идэвхтэй дэлгэцийг л шинэчилнэ.
   Оруулах / Гаргах / Худалдан авах дэлгэц бүртгэлгүй — хагас бөглөсөн
   маягтыг дундуур нь арчихгүйн тулд. */
export function refreshActive(){
  const id=activeScreen();
  const fn=id && renderers[id];
  if(fn) fn();
}
export function closeAllSel(){
  document.querySelectorAll(".sel").forEach(s=>s.classList.remove("open"));
  window.__openSel=null;
}
