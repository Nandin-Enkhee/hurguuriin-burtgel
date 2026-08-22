/* Гаднаас худалдаж авсан — үлдэгдэлд нэмэгдэж, нийлүүлэгчид өглөг үүснэ.
   Ажилчны цалин бодогдохгүй. */
import { db, state, uid, saveLocal } from './state.js';
import { esc, f, int, num, isoStr, tsOfIso, itemName, itemBuyPrice, money,
         hasKg, hasPcs, mainUnitOf, uShort, isSack, sackNote, fridgeName } from './util.js';
import { $, toast, selectHTML, partyOptions, partyPlaceholder, onChoose } from './ui.js';
import { show } from './router.js';
import { registerPicker, renderPicker, qtyOf } from './picker.js';
import { fbSet, save, pushSettings, nextNo } from './sync.js';
import { requireOnline } from './auth.js';
import { openFridge } from './fridge.js';
import { drawPurchaseReceipt } from './receipt.js';

const B = () => state.buy;

/* ---------- Гаднаас авах аргаа сонгох ---------- */
export function openBuyChoice(){
  if(!requireOnline()) return;
  if(!state.isAdmin){ toast("Энэ хэсэг зөвхөн админд нээлттэй"); return; }
  show("scrBuyChoice");
}

registerPicker("buy",{
  boxId:"buyItems",
  sel: () => B().items,
  fridge: () => B().fridge,
  onAdd: id => { if(!B().prices[id]) B().prices[id]=String(itemBuyPrice(id)||""); },
  afterFields: id => `<div class="pick-fields" style="padding-bottom:6px">
      <label class="fld">
        <input class="num-in" type="number" inputmode="decimal" min="0" value="${esc(B().prices[id]||"")}"
               oninput="setBuyPrice('${id}',this.value)">
        <span>₮/${uShort(mainUnitOf(id))}</span></label></div>`,
  lineHTML: id => buyLineText(id),
  onChange: () => renderBuyTotal()
});

export function openBuy(){
  if(!requireOnline()) return;
  if(!state.isAdmin){ toast("Энэ хэсэг зөвхөн админд нээлттэй"); return; }
  state.buy={ date:isoStr(), fridge:state.curFridge||1, supplier:null,
              supplierKind:null, items:{}, prices:{} };
  const d=$("buyDate"); d.value=B().date; d.max=isoStr();
  $("bpName").value=""; $("bpPhone").value="";
  $("buyBtn1").textContent=fridgeName(1);
  $("buyBtn2").textContent=fridgeName(2);
  document.querySelectorAll("#buySeg button").forEach((b,i)=>b.classList.toggle("on", i===B().fridge-1));
  renderBuy(); show("scrBuy");
}
export function setBuyDate(v){ B().date = v || isoStr(); }
export function setBuyFridge(id,btn){
  B().fridge=id; B().items={};
  document.querySelectorAll("#buySeg button").forEach(b=>b.classList.remove("on"));
  btn.classList.add("on");
  renderBuy();
}
onChoose.supplier = id => {
  const b=B();
  if(id==="__kind_person"){ b.supplierKind="person"; b.supplier=null; renderBuy(); return; }
  if(id==="__kind_org")   { b.supplierKind="org";    b.supplier=null; renderBuy(); return; }
  if(id==="__back")       { b.supplierKind=null;     b.supplier=null; renderBuy(); return; }
  b.supplier=id; renderBuy();
  if(id==="__addorg")    setTimeout(()=>$("bsName").focus(),50);
  if(id==="__addperson") setTimeout(()=>$("bpName").focus(),50);
};
export function addSupplierInline(){
  if(!requireOnline()) return;
  const n=$("bsName").value.trim();
  if(!n){ toast("Байгууллагын нэрийг бичнэ үү"); return; }
  const p={id:uid(),name:n,reg:$("bsReg").value.trim(),phone:$("bsPhone").value.trim()};
  db.partners.push(p); save();
  $("bsName").value=""; $("bsReg").value=""; $("bsPhone").value="";
  B().supplier=p.id; renderBuy();
  toast(n+" нэмэгдэж сонгогдлоо");
}
export function addSupplierPersonInline(){
  if(!requireOnline()) return;
  const n=$("bpName").value.trim();
  if(!n){ toast("Хувь хүний нэрийг бичнэ үү"); return; }
  db.persons=db.persons||[];
  const p=db.persons.find(x=>x.name.toLowerCase()===n.toLowerCase())
       || {id:uid(),name:n,phone:$("bpPhone").value.trim()};
  if(db.persons.indexOf(p)<0) db.persons.push(p);
  else if(!p.phone) p.phone=$("bpPhone").value.trim();
  save();
  $("bpName").value=""; $("bpPhone").value="";
  B().supplier=p.id; B().supplierKind="person"; renderBuy();
  toast(n+" нэмэгдэж сонгогдлоо");
}
export function renderBuy(){
  const b=B();
  $("sel_supplier").innerHTML=selectHTML("supplier",partyOptions(b.supplierKind,db.partners,db.persons),b.supplier,partyPlaceholder(b.supplierKind));
  $("buyOrgBox").style.display    = b.supplier==="__addorg" ? "block" : "none";
  $("buyPersonBox").style.display = b.supplier==="__addperson" ? "block" : "none";
  renderPicker("buy"); renderBuyTotal();
}
export function setBuyPrice(id,v){
  B().prices[id]=v;
  const el=$("ls_buy_"+id); if(el) el.textContent=buyLineText(id);
  renderBuyTotal();
}
function buyQty(id){ return qtyOf(B().items[id],id); }
function buyLineText(id){
  const q=buyQty(id), pr=f(B().prices[id]);
  if(q<=0) return "Тоо хэмжээ, үнээ оруулна уу";
  const sn=isSack(id)?sackNote(id,q):"";
  return `${q} ${uShort(mainUnitOf(id))}${sn?` (${sn})`:""} × ${money(pr)} = ${money(q*pr)}`;
}
function buyTotal(){
  return Object.keys(B().items).reduce((s,id)=>s+buyQty(id)*f(B().prices[id]),0);
}
export function renderBuyTotal(){
  $("buyTotal").innerHTML=`<div class="total-line"><span>Нийт төлөх</span><b>${money(buyTotal())}</b></div>`;
}

export async function saveBuy(){
  if(!requireOnline()) return;
  if(state.busy.buy) return;
  const b=B();
  const ids=Object.keys(b.items).filter(id=>buyQty(id)>0);
  if(!ids.length){ toast("Бараа болон хэмжээг нь оруулна уу"); return; }
  if(!b.supplier || b.supplier==="__addorg" || b.supplier==="__addperson"){ toast("Хэнээс авснаа сонгоно уу"); return; }

  state.busy.buy=true;
  const btn=$("buySave"); const label=btn?btn.textContent:"";
  if(btn){ btn.disabled=true; btn.textContent="Хадгалж байна…"; }
  try{
    const sup = b.supplierKind==="person"
      ? (p=>({name:p.name,reg:"",phone:p.phone||"",type:"person",pid:p.id}))(db.persons.find(x=>x.id===b.supplier)||{name:"—",phone:""})
      : (p=>({name:p.name,reg:p.reg||"",phone:p.phone||"",type:"org",pid:p.id}))(db.partners.find(x=>x.id===b.supplier));

    const ts=tsOfIso(b.date);
    const lines=ids.map(id=>{
      const v=b.items[id];
      return { item:id, name:itemName(id), unit:mainUnitOf(id), qty:num(buyQty(id)),
               kg: hasKg(id)?num(f(v.kg)):0, pcs: hasPcs(id)?int(v.pcs):0,
               perSack: isSack(id)?int(v.per):0, sacks: isSack(id)?int(v.sacks):0,
               price:f(b.prices[id]) };
    });
    const total=lines.reduce((s,l)=>s+l.qty*l.price,0);

    const n=await nextNo("purchaseNo");
    db.purchaseNo=n;
    const pu={ id:uid(), no:("000000"+n).slice(-6), ts, fridge:b.fridge,
               supplier:sup, lines, total, paid:false, paidTs:null };
    db.purchases.push(pu);

    const fresh=lines.map(l=>{
      const rec={id:uid(),ts,fridge:pu.fridge,item:l.item,worker:null,
                 action:"in",kg:l.kg,pcs:l.pcs,receipt:null,purchase:pu.id};
      db.log.push(rec); return rec;
    });
    saveLocal();
    fbSet("purchases",pu.id,pu);
    fresh.forEach(r=>fbSet("log",r.id,r));
    pushSettings();
    toast(`ХАВ-${pu.no} бүртгэгдлээ · ${money(total)} өглөг`);
    state.curFridge=pu.fridge;
    openFridge(state.curFridge);
  } finally {
    state.busy.buy=false;
    const x=$("buySave"); if(x){ x.disabled=false; x.textContent=label||"Хадгалах"; }
  }
}

/* ==================== Шууд хөргүүрт оруулах ====================
   Ангилал сонгохгүйгээр, юу авснаа гараар бичээд, тоо, үнийн дүнгээ
   оруулаад шууд өглөгт бүртгэнэ. Хөргүүрийн бараа тус бүрийн
   үлдэгдэлд (ангилалтай холбоотой тул) нөлөөлөхгүй — зөвхөн
   өглөг, баримтын түүхэнд бичигдэнэ. */
const QB = () => state.qbuy;

export function openQuickBuy(){
  if(!requireOnline()) return;
  if(!state.isAdmin){ toast("Энэ хэсэг зөвхөн админд нээлттэй"); return; }
  state.qbuy={ date:isoStr(), supplier:null, supplierKind:null, item:"", qty:"", price:"" };
  const d=$("qbDate"); d.value=QB().date; d.max=isoStr();
  $("qbsName").value=""; $("qbsReg").value=""; $("qbsPhone").value="";
  $("qbpName").value=""; $("qbpPhone").value="";
  $("qbItem").value=""; $("qbQty").value=""; $("qbPrice").value="";
  renderQuickBuy(); show("scrQuickBuy");
}
export function setQbDate(v){ QB().date = v || isoStr(); }
export function setQbItem(v){ QB().item=v; }
export function setQbQty(v){ QB().qty=v; renderQbTotal(); }
export function setQbPrice(v){ QB().price=v; renderQbTotal(); }

onChoose.qbsupplier = id => {
  const q=QB();
  if(id==="__kind_person"){ q.supplierKind="person"; q.supplier=null; renderQuickBuy(); return; }
  if(id==="__kind_org")   { q.supplierKind="org";    q.supplier=null; renderQuickBuy(); return; }
  if(id==="__back")       { q.supplierKind=null;     q.supplier=null; renderQuickBuy(); return; }
  q.supplier=id; renderQuickBuy();
  if(id==="__addorg")    setTimeout(()=>$("qbsName").focus(),50);
  if(id==="__addperson") setTimeout(()=>$("qbpName").focus(),50);
};
export function addQbOrgInline(){
  if(!requireOnline()) return;
  const n=$("qbsName").value.trim();
  if(!n){ toast("Байгууллагын нэрийг бичнэ үү"); return; }
  const p={id:uid(),name:n,reg:$("qbsReg").value.trim(),phone:$("qbsPhone").value.trim()};
  db.partners.push(p); save();
  $("qbsName").value=""; $("qbsReg").value=""; $("qbsPhone").value="";
  QB().supplier=p.id; renderQuickBuy();
  toast(n+" нэмэгдэж сонгогдлоо");
}
export function addQbPersonInline(){
  if(!requireOnline()) return;
  const n=$("qbpName").value.trim();
  if(!n){ toast("Хувь хүний нэрийг бичнэ үү"); return; }
  db.persons=db.persons||[];
  const p=db.persons.find(x=>x.name.toLowerCase()===n.toLowerCase())
       || {id:uid(),name:n,phone:$("qbpPhone").value.trim()};
  if(db.persons.indexOf(p)<0) db.persons.push(p);
  else if(!p.phone) p.phone=$("qbpPhone").value.trim();
  save();
  $("qbpName").value=""; $("qbpPhone").value="";
  QB().supplier=p.id; QB().supplierKind="person"; renderQuickBuy();
  toast(n+" нэмэгдэж сонгогдлоо");
}
export function renderQuickBuy(){
  const q=QB();
  $("sel_qbsupplier").innerHTML=selectHTML("qbsupplier",partyOptions(q.supplierKind,db.partners,db.persons),q.supplier,partyPlaceholder(q.supplierKind));
  $("qbOrgBox").style.display    = q.supplier==="__addorg" ? "block" : "none";
  $("qbPersonBox").style.display = q.supplier==="__addperson" ? "block" : "none";
  renderQbTotal();
}
function qbTotal(){ return f(QB().qty)*f(QB().price); }
export function renderQbTotal(){
  $("qbTotal").innerHTML=`<div class="total-line"><span>Нийт дүн</span><b>${money(qbTotal())}</b></div>`;
}

export async function saveQuickBuy(){
  if(!requireOnline()) return;
  if(state.busy.qbuy) return;
  const q=QB();
  const name=(q.item||"").trim();
  const qty=f(q.qty), price=f(q.price);
  if(!name){ toast("Юу авснаа бичнэ үү"); return; }
  if(qty<=0){ toast("Тоо хэмжээгээ оруулна уу"); return; }
  if(price<=0){ toast("Үнийн дүнгээ оруулна уу"); return; }
  if(!q.supplier || q.supplier==="__addorg" || q.supplier==="__addperson"){ toast("Хэнээс авснаа сонгоно уу"); return; }

  state.busy.qbuy=true;
  const btn=$("qbSave"); const label=btn?btn.textContent:"";
  if(btn){ btn.disabled=true; btn.textContent="Хадгалж байна…"; }
  try{
    const sup = q.supplierKind==="person"
      ? (p=>({name:p.name,reg:"",phone:p.phone||"",type:"person",pid:p.id}))(db.persons.find(x=>x.id===q.supplier)||{name:"—",phone:""})
      : (p=>({name:p.name,reg:p.reg||"",phone:p.phone||"",type:"org",pid:p.id}))(db.partners.find(x=>x.id===q.supplier));

    const ts=tsOfIso(q.date);
    const line={ item:null, name, unit:"kg", qty:num(qty), kg:0, pcs:0, perSack:0, sacks:0, price:num(price) };
    const total=num(qty*price);

    const n=await nextNo("purchaseNo");
    db.purchaseNo=n;
    const pu={ id:uid(), no:("000000"+n).slice(-6), ts, fridge:state.curFridge||1,
               supplier:sup, lines:[line], total, paid:false, paidTs:null };
    db.purchases.push(pu);
    saveLocal();
    fbSet("purchases",pu.id,pu);
    pushSettings();
    toast(`ХАВ-${pu.no} бүртгэгдлээ · ${money(total)} өглөг`);
    drawPurchaseReceipt(pu);
  } finally {
    state.busy.qbuy=false;
    const x=$("qbSave"); if(x){ x.disabled=false; x.textContent=label||"Хадгалах"; }
  }
}
