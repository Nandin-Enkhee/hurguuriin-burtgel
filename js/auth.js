/* Дэлгэц солих, дахин зурах, буцах түүх.
   Дэлгэц бүр өөрийгөө бүртгүүлнэ — if/else гинж хэрэггүй. */
const renderers = {};

/* Түр зуурын маягт бүхий дэлгэцүүд түүхэнд хадгалагдахгүй —
   хадгалсны дараа буцахад хагас бөглөсөн маягт руу орохоос сэргийлнэ. */
const SKIP = ["scrLogin","scrEntry","scrWork","scrOut","scrBuy","scrReceipt"];
let stack=[], current=null;

export function registerScreen(id, render){ renderers[id] = render; }

function paint(id){
  closeAllSel();
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  const el=document.getElementById(id);
  if(el) el.classList.add("active");
  current=id;
  window.scrollTo(0,0);
}

export function show(id){
  paint(id);
  if(SKIP.indexOf(id)<0 && stack[stack.length-1]!==id) stack.push(id);
}
/* Түүхэнд нэмэлгүй солино — буцах үед ашиглана */
export function replace(id){
  paint(id);
  if(SKIP.indexOf(id)<0){
    if(stack[stack.length-1]!==id) stack[stack.length-1]=id;
  }
}
export function goBack(){
  if(SKIP.indexOf(current)<0) stack.pop();
  const prev=stack[stack.length-1];
  if(!prev){ resetHistory(); paint("scrHome"); stack=["scrHome"]; }
  else paint(prev);
  const fn=renderers[stack[stack.length-1]||"scrHome"];
  if(fn) fn();
}
export function resetHistory(){ stack=[]; }
export function activeScreen(){ return current; }

/* Сервер талаас өгөгдөл ирэхэд идэвхтэй дэлгэцийг л шинэчилнэ. */
export function refreshActive(){
  const fn = current && renderers[current];
  if(fn) fn();
}
export function closeAllSel(){
  document.querySelectorAll(".sel").forEach(s=>s.classList.remove("open"));
  window.__openSel=null;
}
