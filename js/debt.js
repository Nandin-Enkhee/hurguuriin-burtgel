/* Өглөг, авлага — байгууллага тус бүрээр нэгтгэнэ.
   Урьдчилгаа болон хэсэгчилсэн төлбөр нийт дүнгээс хасагдана. */
import { db, state, uid, saveLocal } from './state.js';
import { esc, f, num, money, dateStr, timeStr, isoStr, isoMonth,
         dayKey, dayKeyOfIso, monthKey, monthKeyOfIso, lQty, lUnit, uShort } from './util.js';
import { $, toast } from './ui.js';
import { show, registerScreen } from './router.js';
import { fbSet, fbDel } from './sync.js';
import { openOneReceipt } from './receipt.js';
import { requireOnline } from './auth.js';

const DB_ = () => state.debt;

/* Хаанаас нээгдснийг санаж, Буцах товч тэр газар руугаа буцаана.
   "dash" — Хяналтын самбараас, эсрэг тохиолдолд Тохиргооноос. */
let cameFrom = "admin";

export function openDebt(from){
  if(!state.isAdmin){ toast("Энэ хэсэг зөвхөн админд нээлттэй"); return; }
  if(!requireOnline()) return;
  cameFrom = from || "admin";
  DB_().openOrg=null;
  DB_().month = DB_().month || isoMonth();
  DB_().date  = DB_().date  || isoStr();
  $("debtSearch").value=DB_().search;
  syncDebtPicker(); renderDebt(); show("scrDebt");
}
export function closeDebt(){
  if(cameFrom==="dash" && window.openDash){ window.openDash(); return; }
  if(window.openAdmin){ window.openAdmin(); return; }
  show("scrAdmin");
}
/* Он сар, тодорхой өдөр, эсвэл бүх хугацаагаар шүүнэ */
function syncDebtPicker(){
  const r=DB_().range;
  const m=$("debtMonth"), d=$("debtDate");
  m.value=DB_().month; m.max=isoMonth();
  d.value=DB_().date;  d.max=isoStr();
  m.style.display = r==="month" ? "block" : "none";
  d.style.display = r==="day"   ? "block" : "none";
  ["dbR1","dbR2","dbR3"].forEach(id=>$(id).classList.remove("on"));
  $(r==="month"?"dbR1":(r==="day"?"dbR2":"dbR3")).classList.add("on");
}
export function setDebtRange(r){
  DB_().range=r; DB_().openOrg=null;
  syncDebtPicker(); renderDebt();
}
export function setDebtDate(v){ DB_().date = v || isoStr(); DB_().openOrg=null; renderDebt(); }
function inRange(ts){
  const r=DB_().range;
  if(r==="all") return true;
  if(r==="day") return dayKey(ts)===dayKeyOfIso(DB_().date||isoStr());
  return monthKey(ts)===monthKeyOfIso(DB_().month||isoMonth());
}
function rangeLabel(){
  const r=DB_().range;
  if(r==="day") return dateStr(new Date((DB_().date||isoStr())+"T00:00:00"));
  if(r==="all") return "Бүх хугацаа";
  const a=(DB_().month||isoMonth()).split("-");
  return a[0]+" оны "+(+a[1])+"-р сар";
}
export function setDebtKind(k,btn){
  DB_().kind=k; DB_().openOrg=null;
  document.querySelectorAll("#debtSeg button").forEach(b=>b.classList.remove("on"));
  btn.classList.add("on"); renderDebt();
}
export function setDebtMonth(v){ DB_().month = v || isoMonth(); DB_().openOrg=null; renderDebt(); }
export function setDebtSearch(v){ DB_().search=v; renderDebt(); }
export function setDebtShow(v,btn){
  DB_().show=v;
  ["dbShow1","dbShow2","dbShow3"].forEach(id=>$(id).classList.remove("on"));
  btn.classList.add("on"); renderDebt();
}
export function toggleDebtOrg(k){ DB_().openOrg = DB_().openOrg===k ? null : k; renderDebt(); }

function orgKey(who){ return (who&&who.pid) ? who.pid : ("name:"+((who&&who.name)||"—")); }

export function debtGroups(){
  const isDue = DB_().kind==="due";
  const src = isDue ? db.receipts : db.purchases;
  const groups={};
  src.forEach(r=>{
    if(!inRange(r.ts)) return;
    const who=(isDue?r.buyer:r.supplier)||{name:"—"};
    const k=orgKey(who);
    const g = groups[k] = groups[k] || {key:k,pid:who.pid||null,name:who.name,docs:[],pays:[],total:0,paid:0};
    g.docs.push(r); g.total+=r.total;
  });
  (db.settlements||[]).forEach(x=>{
    if(x.kind!==DB_().kind || !inRange(x.ts)) return;
    const k = x.pid || ("name:"+x.name);
    const g = groups[k] = groups[k] || {key:k,pid:x.pid||null,name:x.name,docs:[],pays:[],total:0,paid:0};
    g.pays.push(x); g.paid+=x.amount;
  });
  Object.values(groups).forEach(g=>{
    g.rest=num(g.total-g.paid);
    g.done = g.total>0 && g.rest<=0.5;
    g.docs.sort((a,b)=>b.ts-a.ts);
    g.pays.sort((a,b)=>b.ts-a.ts);
  });
  return groups;
}

export function renderDebt(){
  const isDue=DB_().kind==="due";
  const groups=debtGroups();
  const q=(DB_().search||"").trim().toLowerCase();
  const keys=Object.keys(groups).filter(k=>{
    const g=groups[k];
    if(q && g.name.toLowerCase().indexOf(q)<0) return false;
    if(DB_().show==="open" && g.done) return false;
    if(DB_().show==="done" && !g.done) return false;
    return true;
  }).sort((a,b)=>groups[b].rest-groups[a].rest);

  let total=0,paid=0;
  Object.values(groups).forEach(g=>{ total+=g.total; paid+=g.paid; });
  $("debtSummary").innerHTML=`
    <div class="item-row"><span class="item-name">${rangeLabel()}</span>
      <span class="item-val" style="font-size:14px;color:var(--muted)">${keys.length} харилцагч</span></div>
    <div class="item-row"><span class="item-name">Нийт ${isDue?"авлага":"өглөг"}</span><span class="item-val">${money(total)}</span></div>
    <div class="item-row"><span class="item-name">${isDue?"Авсан":"Өгсөн"} мөнгө</span><span class="item-val" style="color:var(--moss)">${money(paid)}</span></div>
    <div class="item-row"><span class="item-name">Үлдэгдэл</span><span class="item-val" style="color:var(--rust)">${money(total-paid)}</span></div>`;

  const pre = isDue ? "БАР-" : "ХАВ-";
  $("debtList").innerHTML = keys.length ? keys.map(k=>{
    const g=groups[k], open=DB_().openOrg===k;
    let h=`<button type="button" class="exp-head${g.done?" paid":""}" onclick="toggleDebtOrg('${esc(k)}')">
      <span class="exp-arrow">${open?"▾":"▸"}</span>
      <span class="exp-main">${esc(g.name)}<small>${g.docs.length} бичилт · нийт ${money(g.total)}${g.paid?` · ${isDue?"авсан":"өгсөн"} ${money(g.paid)}`:""}</small></span>
      <span class="exp-val">${g.done?`<span class="pill pill-ok">Дууссан</span>`:`<span class="pill pill-due">${money(g.rest)}</span>`}</span></button>`;
    if(open){
      h+=`<div class="exp-body">`;
      h+=g.docs.map(r=>`
        <div class="item-row" style="cursor:pointer" onclick="${isDue?`openOneReceipt('${r.id}')`:`showPurchase('${r.id}')`}">
          <span class="item-name">${pre}${r.no}
            <small>${dateStr(new Date(r.ts))} ${timeStr(new Date(r.ts))} · ${esc(r.lines.map(l=>l.name+" "+lQty(l)+uShort(lUnit(l))).join(", "))}</small></span>
          <span class="item-val">${money(r.total)}</span></div>`).join("");
      if(g.pays.length){
        h+=`<div class="grp-head">${isDue?"Авсан төлбөр":"Өгсөн төлбөр"}</div>`;
        h+=g.pays.map(x=>`
          <div class="item-row"><span class="item-name" style="color:var(--moss)">${dateStr(new Date(x.ts))}
            ${x.note?`<small>${esc(x.note)}</small>`:""}</span>
            <span class="item-val" style="color:var(--moss)">${money(x.amount)}
              <button class="icon-btn" style="padding:5px 9px;font-size:13px;margin-left:6px"
                      onclick="event.stopPropagation();delSettlement('${x.id}')">✕</button></span></div>`).join("");
      }
      h+=`<div class="total-line"><span>Үлдэгдэл</span><b>${money(g.rest)}</b></div>`;
      h+=`<div class="row-2" style="margin:12px 0 4px">
            <button class="btn btn-in btn-sm" onclick="addSettlement('${esc(k)}')">${isDue?"Мөнгө авсан":"Мөнгө өгсөн"}</button>
            <button class="btn btn-sm" onclick="settleAll('${esc(k)}')">${g.done?"Тооцоог буцаах":"Тооцоо дууссан"}</button></div>`;
      h+=`</div>`;
    }
    return h;
  }).join("") : `<div class="empty">Тохирох бүртгэл алга.<br>Он, сар эсвэл шүүлтүүрээ шалгана уу.</div>`;
}

export function showPurchase(id){
  const p=db.purchases.find(x=>x.id===id);
  if(!p) return;
  alert(`ХАВ-${p.no}\n${dateStr(new Date(p.ts))} ${timeStr(new Date(p.ts))}\n${p.supplier.name}\n\n`
    + p.lines.map(l=>`${l.name}: ${lQty(l)} ${uShort(lUnit(l))} × ${money(l.price)} = ${money(lQty(l)*l.price)}`).join("\n")
    + `\n\nНийт: ${money(p.total)}`);
}
function saveSettlement(st){
  db.settlements.push(st);
  saveLocal(); fbSet("settlements",st.id,st);
}
export function addSettlement(k){
  if(!requireOnline()) return;
  const g=debtGroups()[k];
  if(!g){ toast("Бүртгэл олдсонгүй"); return; }
  const isDue=DB_().kind==="due";
  const v=prompt(`${isDue?"Хэдэн төгрөг авсан бэ?":"Хэдэн төгрөг өгсөн бэ?"}\nҮлдэгдэл: ${money(g.rest)}`,
                 String(Math.max(0,Math.round(g.rest))));
  if(v===null) return;
  const amt=f(v);
  if(amt<=0){ toast("Дүнгээ оруулна уу"); return; }
  const note=prompt("Тайлбар — жишээ: урьдчилгаа (заавал биш)","")||"";
  saveSettlement({id:uid(),ts:Date.now(),kind:DB_().kind,pid:g.pid,name:g.name,amount:num(amt),note:note.trim()});
  renderDebt(); toast(money(amt)+" бүртгэгдлээ");
}
export function settleAll(k){
  if(!requireOnline()) return;
  const g=debtGroups()[k];
  if(!g) return;
  const isDue=DB_().kind==="due";
  if(g.done){
    const auto=g.pays.filter(x=>x.settle);
    if(!auto.length){ toast("Гараар оруулсан төлбөрийг ✕ товчоор устгана уу"); return; }
    if(!confirm("Тооцоо дууссан тэмдэглэгээг буцаах уу?")) return;
    const ids=auto.map(x=>x.id);
    db.settlements=db.settlements.filter(x=>ids.indexOf(x.id)<0);
    saveLocal(); ids.forEach(id=>fbDel("settlements",id));
    renderDebt(); toast("Буцаалаа");
    return;
  }
  if(g.rest<=0){ toast("Үлдэгдэл алга"); return; }
  if(!confirm(`${g.name}\nҮлдэгдэл ${money(g.rest)} бүрэн ${isDue?"авсан":"өгсөн"} гэж тэмдэглэх үү?`)) return;
  saveSettlement({id:uid(),ts:Date.now(),kind:DB_().kind,pid:g.pid,name:g.name,
                  amount:num(g.rest),note:"Үлдэгдлийг бүрэн барагдуулав",settle:true});
  renderDebt(); toast("Тооцоо дууслаа");
}
export function delSettlement(id){
  if(!requireOnline()) return;
  if(!confirm("Энэ төлбөрийн бичилтийг устгах уу?")) return;
  db.settlements=db.settlements.filter(x=>x.id!==id);
  saveLocal(); fbDel("settlements",id);
  renderDebt(); toast("Устгалаа");
}
registerScreen("scrDebt", renderDebt);
