/* Гаргах: хүлээн авагч сонгож, бараагаа бүртгээд төлбөрийн баримт үүсгэнэ */
import { db, state, uid, saveLocal } from './state.js';
import { esc, f, int, num, itemName, itemPrice, money, mainUnitOf, uShort,
         isSack, sackNote, trackOf, stock, lQty, lUnit, lineSummary,
         fridgeName, perSackOf } from './util.js';
import { $, toast, selectHTML, partyOptions, partyPlaceholder, onChoose } from './ui.js';
import { show } from './router.js';
import { registerPicker, renderPicker, qtyOf } from './picker.js';
import { fbSet, fbDel, save, pushSettings, nextNo } from './sync.js';
import { requireOnline } from './auth.js';
import { openFridge } from './fridge.js';
import { drawReceipt } from './receipt.js';

const C = () => state.cart;

registerPicker("out",{
  boxId:"outItems",
  sel: () => C().items,
  fridge: () => state.curFridge,
  showStock: true,
  ignoreRc: () => C().editId,
  onAdd: id => { const v=C().items[id]; if(isSack(id)&&perSackOf(id)) v.per=String(perSackOf(id)); },
  lineHTML: id => lineText(id),
  onChange: () => renderOutTotal()
});

export function openOut(){
  if(!requireOnline()) return;
  const known = db.lastIssuer && db.workers.some(w=>w.id===db.lastIssuer && !w.hidden) ? db.lastIssuer : null;
  state.cart={ partner:null, partnerKind:null, issuer:known,
               items:{}, pcs:{}, per:{}, sacks:{}, editId:null };
  $("personName").value=""; $("personPhone").value="";
  renderOut(); show("scrOut");
}
export function editCurrentReceipt(){
  const rc=db.receipts.find(x=>x.id===state.receipt.current);
  if(!rc){ show("scrHome"); return; }
  state.curFridge=rc.fridge;
  state.cart={ partner:null, partnerKind:null, issuer:rc.issuer,
               items:{}, pcs:{}, per:{}, sacks:{}, editId:rc.id };
  const c=C();
  if(rc.buyer.type==="person"){
    c.partnerKind="person";
    let p=db.persons.find(x=>x.id===rc.buyer.pid) || db.persons.find(x=>x.name===rc.buyer.name);
    if(!p){ p={id:uid(),name:rc.buyer.name,phone:rc.buyer.phone||""}; db.persons.push(p); save(); }
    c.partner=p.id;
  }else{
    c.partnerKind="org";
    const p=db.partners.find(x=>x.id===rc.buyer.pid) || db.partners.find(x=>x.name===rc.buyer.name);
    if(p) c.partner=p.id;
    else{
      const np={id:uid(),name:rc.buyer.name,reg:rc.buyer.reg||"",phone:rc.buyer.phone||""};
      db.partners.push(np); save(); c.partner=np.id;
    }
  }
  rc.lines.forEach(l=>{
    const v={kg:"",pcs:"",per:"",sacks:""};
    if(lUnit(l)==="pcs") v.pcs=String(lQty(l));
    else{ v.kg=String(lQty(l)); if(l.pcs) v.pcs=String(l.pcs); }
    if(isSack(l.item)){ v.per=String(l.perSack||perSackOf(l.item)||""); v.sacks=String(l.sacks||""); }
    c.items[l.item]=v;
  });
  $("personName").value=""; $("personPhone").value="";
  renderOut(); show("scrOut");
}
export function leaveOut(){
  const c=C();
  if(c.editId){
    const rc=db.receipts.find(x=>x.id===c.editId);
    if(rc){ drawReceipt(rc); return; }
  }
  openFridge(state.curFridge);
}
onChoose.partner = id => {
  const c=C();
  if(id==="__kind_person"){ c.partnerKind="person"; c.partner=null; renderOut(); return; }
  if(id==="__kind_org")   { c.partnerKind="org";    c.partner=null; renderOut(); return; }
  if(id==="__back")       { c.partnerKind=null;     c.partner=null; renderOut(); return; }
  c.partner=id; renderOut();
  if(id==="__addorg")    setTimeout(()=>$("noName").focus(),50);
  if(id==="__addperson") setTimeout(()=>$("personName").focus(),50);
};
onChoose.issuer = id => { C().issuer=id; db.lastIssuer=id; save(); renderOut(); };

export function addOrgInline(){
  if(!requireOnline()) return;
  const n=$("noName").value.trim();
  if(!n){ toast("Байгууллагын нэрийг бичнэ үү"); return; }
  const p={id:uid(),name:n,reg:$("noReg").value.trim(),phone:$("noPhone").value.trim()};
  db.partners.push(p); save();
  $("noName").value=""; $("noReg").value=""; $("noPhone").value="";
  C().partner=p.id; renderOut();
  toast(n+" нэмэгдэж сонгогдлоо");
}
export function addPersonInline(){
  if(!requireOnline()) return;
  const n=$("personName").value.trim();
  if(!n){ toast("Хувь хүний нэрийг бичнэ үү"); return; }
  db.persons=db.persons||[];
  /* Нэг хүнийг давхар бичихээс сэргийлж, байгаа бол түүнийг нь сонгоно */
  const p=db.persons.find(x=>x.name.toLowerCase()===n.toLowerCase())
       || {id:uid(),name:n,phone:$("personPhone").value.trim()};
  if(db.persons.indexOf(p)<0) db.persons.push(p);
  else if(!p.phone) p.phone=$("personPhone").value.trim();
  save();
  $("personName").value=""; $("personPhone").value="";
  C().partner=p.id; C().partnerKind="person"; renderOut();
  toast(n+" нэмэгдэж сонгогдлоо");
}
export function renderOut(){
  const c=C();
  if(c.editId){
    const rc=db.receipts.find(x=>x.id===c.editId);
    $("outTitle").textContent="БАР-"+(rc?rc.no:"")+" засах";
    $("outSave").textContent="Засварыг хадгалах";
  }else{
    $("outTitle").textContent="Гаргах · "+fridgeName(state.curFridge);
    $("outSave").textContent="Баримт гаргах";
  }
  $("sel_partner").innerHTML=selectHTML("partner",partyOptions(c.partnerKind,db.partners,db.persons),c.partner,partyPlaceholder(c.partnerKind));
  $("sel_issuer").innerHTML =selectHTML("issuer",db.workers.filter(w=>!w.hidden),c.issuer,"Ажилтнаа сонгоно уу");
  $("personBox").style.display = c.partner==="__addperson" ? "block" : "none";
  $("newOrgBox").style.display = c.partner==="__addorg" ? "block" : "none";
  renderPicker("out"); renderOutTotal();
}
function outQty(id){ return qtyOf(C().items[id],id); }
function lineText(id){
  const q=outQty(id);
  if(q<=0) return `Үнэ: ${money(itemPrice(id))} / ${uShort(mainUnitOf(id))}`;
  const sn=isSack(id)?sackNote(id,q):"";
  return `${q} ${uShort(mainUnitOf(id))}${sn?` (${sn})`:""} × ${money(itemPrice(id))} = ${money(q*itemPrice(id))}`;
}
function outTotal(){ return Object.keys(C().items).reduce((s,id)=>s+outQty(id)*itemPrice(id),0); }
export function renderOutTotal(){
  $("outTotal").innerHTML=`<div class="total-line"><span>Нийт дүн</span><b>${money(outTotal())}</b></div>`;
}

export async function makeReceipt(){
  if(!requireOnline()) return;
  if(state.busy.receipt) return;
  const c=C();
  const ids=Object.keys(c.items).filter(id=>outQty(id)>0);
  if(!ids.length){ toast("Бараа болон хэмжээг нь оруулна уу"); return; }
  if(!c.partner || c.partner==="__addorg" || c.partner==="__addperson"){ toast("Хүлээн авагчаа сонгоно уу"); return; }
  if(!c.issuer){ toast("Олгосон ажилтнаа сонгоно уу"); return; }
  for(const id of ids){
    const s=stock(state.curFridge,id,c.editId);
    const have = mainUnitOf(id)==="pcs" ? s.pcs : s.kg;
    if(outQty(id) > have+0.001){ toast(`${itemName(id)}: хөргүүрт ердөө ${have} ${uShort(mainUnitOf(id))} байна`); return; }
    if(trackOf(id)==="both" && int(c.items[id].pcs) > s.pcs){ toast(`${itemName(id)}: хөргүүрт ердөө ${s.pcs} ширхэг байна`); return; }
  }

  state.busy.receipt=true;
  const btn=$("outSave"); const label=btn?btn.textContent:"";
  if(btn){ btn.disabled=true; btn.textContent="Хадгалж байна…"; }
  try{
    const buyer = c.partnerKind==="person"
      ? (p=>({name:p.name,reg:"",phone:p.phone||"",type:"person",pid:p.id}))(db.persons.find(x=>x.id===c.partner)||{name:"—",phone:""})
      : (p=>({name:p.name,reg:p.reg||"",phone:p.phone||"",type:"org",pid:p.id}))(db.partners.find(x=>x.id===c.partner));

    const total=outTotal();
    const lines=ids.map(id=>{
      const v=c.items[id];
      return { item:id, name:itemName(id), qty:num(outQty(id)), unit:mainUnitOf(id),
               pcs: trackOf(id)==="both" ? int(v.pcs) : 0,
               perSack: isSack(id)?int(v.per):0, sacks: isSack(id)?int(v.sacks):0,
               price:itemPrice(id) };
    });
    const ts=Date.now();
    let rc;

    if(c.editId){
      rc=db.receipts.find(x=>x.id===c.editId);
      if(!rc){ toast("Баримт олдсонгүй"); return; }
      const au={ id:uid(), ts, no:rc.no, rcId:rc.id,
        before:{buyer:rc.buyer.name,text:lineSummary(rc),total:rc.total},
        after:{buyer:buyer.name,text:lines.map(l=>`${l.name} ${l.qty} ${uShort(l.unit)}`).join(", "),total} };
      db.audits.push(au); fbSet("audits",au.id,au);
      Object.assign(rc,{buyer,issuer:c.issuer,lines,total,editedTs:ts});
      db.log.filter(e=>e.receipt===rc.id).forEach(e=>fbDel("log",e.id));
      db.log=db.log.filter(e=>e.receipt!==rc.id);
      toast("Засвар хадгалагдлаа");
    }else{
      const n=await nextNo("receiptNo");
      db.receiptNo=n;
      rc={ id:uid(), no:("000000"+n).slice(-6), ts, fridge:state.curFridge,
           buyer, issuer:c.issuer, lines, total, paid:false, paidTs:null, editedTs:null };
      db.receipts.push(rc);
    }
    const fresh=rc.lines.map(l=>{
      const rec={id:uid(),ts,fridge:rc.fridge,item:l.item,worker:null,action:"out",
                 kg: lUnit(l)==="kg" ? lQty(l) : 0,
                 pcs: lUnit(l)==="pcs" ? lQty(l) : (l.pcs||0),
                 receipt:rc.id, purchase:null};
      db.log.push(rec); return rec;
    });
    saveLocal();
    fbSet("receipts",rc.id,rc);
    fresh.forEach(r=>fbSet("log",r.id,r));
    pushSettings();
    drawReceipt(rc);
  } finally {
    state.busy.receipt=false;
    const x=$("outSave"); if(x){ x.disabled=false; x.textContent=label; }
  }
}
