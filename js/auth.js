import { db, state } from './state.js';
import { dateStr, fridgeName } from './util.js';
import { $, toast } from './ui.js';
import { show, registerScreen } from './router.js';
import { syncText, isOnline, onSync } from './sync.js';

let inputs=[];

export function initLogin(){
  inputs=Array.from(document.querySelectorAll(".code-inputs input"));
  inputs.forEach((input,idx)=>{
    input.addEventListener("input",()=>{
      input.value=input.value.replace(/[^0-9]/g,"");
      if(input.value && idx<inputs.length-1) inputs[idx+1].focus();
      if(idx===inputs.length-1 && input.value) checkCode();
    });
    input.addEventListener("keydown",e=>{
      if(e.key==="Backspace" && !input.value && idx>0) inputs[idx-1].focus();
      if(e.key==="Enter") checkCode();
    });
  });
  inputs[0].focus();
}

export function applyLock(){
  const ok=isOnline();
  const btn=$("loginBtn");
  if(btn) btn.disabled=!ok;
  const warn=$("lockWarn");
  if(warn) warn.style.display = ok ? "none" : "block";
  document.querySelectorAll("#scrHome .menu .btn").forEach(b=>{ b.disabled=!ok; });
  const hw=$("homeLock");
  if(hw) hw.style.display = ok ? "none" : "block";
  if(!ok && document.querySelector(".screen.active")?.id!=="scrLogin"){
    state.isAdmin=false;
    show("scrLogin");
  }
}
onSync(applyLock);

export function requireOnline(){
  if(isOnline()) return true;
  toast("Сервертэй холбогдоогүй байна · түр хүлээнэ үү");
  return false;
}

export function checkCode(){
  if(!requireOnline()) return;
  const entered=inputs.map(i=>i.value).join("");
  if(entered.length<4){ $("errorMsg").textContent="4 оронтой кодоо бүтнээр нь оруулна уу"; return; }
  if(entered===db.adminPin)     state.isAdmin=true;
  else if(entered===db.pin)     state.isAdmin=false;
  else{
    $("errorMsg").textContent="Код буруу байна";
    inputs.forEach(i=>i.value=""); inputs[0].focus();
    return;
  }
  $("errorMsg").textContent="";
  inputs.forEach(i=>i.value="");
  renderHome(); show("scrHome");
}
export function logout(){
  state.isAdmin=false;
  state.salaryUnlocked=false;
  show("scrLogin");
  inputs.forEach(i=>i.value=""); inputs[0].focus();
}

export function renderHome(){
  $("homeDate").textContent=dateStr();
  $("syncLine").textContent=syncText();
  applyLock();
  $("btnF1").textContent=fridgeName(1);
  $("btnF2").textContent=fridgeName(2);
  const adminOnly = state.isAdmin ? "block" : "none";
  $("btnDash").style.display=adminOnly;
  $("btnBuy").style.display=adminOnly;
  $("btnAdmin").style.display=adminOnly;
}
export function goHome(){ renderHome(); show("scrHome"); }
registerScreen("scrHome", renderHome);
