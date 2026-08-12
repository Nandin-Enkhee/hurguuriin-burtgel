/* Өглөг, авлага — байгууллага тус бүрээр нэгтгэнэ.
   Урьдчилгаа болон хэсэгчилсэн төлбөр нийт дүнгээс хасагдана. */
import { db, state, uid, saveLocal } from './state.js';
import { esc, f, num, money, dateStr, timeStr, isoMonth, monthKey, monthKeyOfIso,
         lQty, lUnit, uShort } from './util.js';
import { $, toast } from './ui.js';
import { show, registerScreen } from './router.js';
import { fbSet, fbDel } from './sync.js';
import { openOneReceipt } from './receipt.js';

const D = () => state.debt;

export function openDebt(){
  if(!state.isAdmin){ toast("Энэ хэсэг зөвхөн админд нээлттэй"); return; }
  D().openOrg=null;
  D().month = D().month || isoMonth();
  $("debtMonth").value=D().month;
  $("debtSearch").value=D().search;
  renderDebt(); show("scrDebt");
}
export function setDebtKind(k,btn){
  D().kind=k; D().openOrg=null;
  document.querySelectorAll("#debtSeg button").forEach(b=>b.classList.remove("on"));
  btn.classList.add("on"); renderDebt();
}
export function setDebtMonth(v){ D().month = v || isoMonth(); D().openOrg=null; renderDebt(); }
export function setDebtSearch(v){ D().search=v; renderDebt(); }
export function setDebtShow(v,btn){
  D().show=v;
  ["dbShow1","dbShow2","dbShow3"].forEach(id=>$(id).classList.remove("on"));
  btn.classList.add("on"); renderDebt();
}
export function toggleDebtOrg(k){ D().openOrg = D().openOrg===k ? null : k; renderDebt(); }

function orgKey(who){ return (who&&who.pid) ? who.pid : ("name:"+((who&&who.name)||"—")); }

export function debtGroups(){
  const mk=monthKeyOfIso(D().month||isoMonth());
  const isDue = D().kind==="due";
  const src = isDue ? db.receipts : db.purchases;
  const groups={};
  src.forEach(r=>{
    if(monthKey(r.ts)!==mk) return;
    const who=(isDue?r.buyer:r.supplier)||{name:"—"};
    const k=orgKey(who);
    const g = groups[k] = groups[k] || {key:k,pid:who.pid||null,name:who.name,docs:[],pays:[],total:0,paid:0};
    g.docs.push(r); g.total+=r.total;
  });
  (db.settlements||[]).forEach(x=>{
    if(x.kind!==D().kind || monthKey(x.ts)!==mk) return;
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
  const isDue=D().kind==="due";
  const groups=debtGroups();
  const q=(D().search||"").trim().toLowerCase();
  const keys=Object.keys(groups).filter(k=>{
    const g=groups[k];
    if(q && g.name.toLowerCase().indexOf(q)<0) return false;
    if(D().show==="open" && g.done) return false;
    if(D().show==="done" && !g.done) return false;
    return true;
  }).sort((a,b)=>groups[b].rest-groups[a].rest);

  let total=0,paid=0;
  Object.values(groups).forEach(g=>{ total+=g.total; paid+=g.paid; });
  $("debtSummary").innerHTML=`
    <div class="item-row"><span class="item-name">Нийт ${isDue?"авлага":"өглөг"}</span><span class="item-val">${money(total)}</span></div>
    <div class="item-row"><span class="item-name">${isDue?"Авсан":"Өгсөн"} мөнгө</span><span class="item-val" style="color:var(--moss)">${money(paid)}</span></div>
    <div class="item-row"><span class="item-name">Үлдэгдэл</span><span class="item-val" style="color:var(--rust)">${money(total-paid)}</span></div>`;

  const pre = isDue ? "БАР-" : "ХАВ-";
  $("debtList").innerHTML = keys.length ? keys.map(k=>{
    const g=groups[k], open=D().openOrg===k;
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
  const g=debtGroups()[k];
  if(!g){ toast("Бүртгэл олдсонгүй"); return; }
  const isDue=D().kind==="due";
  const v=prompt(`${isDue?"Хэдэн төгрөг авсан бэ?":"Хэдэн төгрөг өгсөн бэ?"}\nҮлдэгдэл: ${money(g.rest)}`,
                 String(Math.max(0,Math.round(g.rest))));
  if(v===null) return;
  const amt=f(v);
  if(amt<=0){ toast("Дүнгээ оруулна уу"); return; }
  const note=prompt("Тайлбар — жишээ: урьдчилгаа (заавал биш)","")||"";
  saveSettlement({id:uid(),ts:Date.now(),kind:D().kind,pid:g.pid,name:g.name,amount:num(amt),note:note.trim()});
  renderDebt(); toast(money(amt)+" бүртгэгдлээ");
}
export function settleAll(k){
  const g=debtGroups()[k];
  if(!g) return;
  const isDue=D().kind==="due";
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
  saveSettlement({id:uid(),ts:Date.now(),kind:D().kind,pid:g.pid,name:g.name,
                  amount:num(g.rest),note:"Үлдэгдлийг бүрэн барагдуулав",settle:true});
  renderDebt(); toast("Тооцоо дууслаа");
}
export function delSettlement(id){
  if(!confirm("Энэ төлбөрийн бичилтийг устгах уу?")) return;
  db.settlements=db.settlements.filter(x=>x.id!==id);
  saveLocal(); fbDel("settlements",id);
  renderDebt(); toast("Устгалаа");
}
registerScreen("scrDebt", renderDebt);
