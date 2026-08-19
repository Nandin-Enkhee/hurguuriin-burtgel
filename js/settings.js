/* Тохиргоо: бараа, хөргүүрийн ангилал, ажилчид, тариф, харилцагч,
   байгууллагын мэдээлэл, код, нөөцлөх */
import { db, state, uid, saveLocal, replaceDb, normalize } from './state.js';
import { esc, f, int, money, itemName, workerName, liveItems, liveWorkers,
         payUnitOf, mainUnitOf, uShort, uLabel, rateOf, fridgeName } from './util.js';
import { $, toast, selectHTML, onChoose } from './ui.js';
import { show } from './router.js';
import { save, fbSet, fbDel, pushSettings, getBackupPin, setBackupPin } from './sync.js';
import { renderHome, requireOnline } from './auth.js';

export function openAdmin(){
  if(!requireOnline()) return;
  if(!state.isAdmin){ toast("Энэ хэсэг зөвхөн админд нээлттэй"); return; }
  show("scrAdmin");
}

/* ---------- Бараа, үнэ ---------- */
export function openItems(){ renderItems(); show("scrItems"); }
export function renderItems(){
  const items=liveItems();
  $("itemsEdit").innerHTML = items.length ? items.map(it=>{
    const tr=it.track||"both", pu=payUnitOf(it.id), mu=mainUnitOf(it.id);
    const payOpts = tr==="both" ? [["kg","кг-аар"],["pcs","ширхгээр"]]
                  : (tr==="kg" ? [["kg","кг-аар"]] : [["pcs","ширхгээр"]]);
    const trackOpts=[["kg","Зөвхөн кг"],["pcs","Зөвхөн ширхэг"],["both","Кг ба ширхэг"],["sack","Шуудайгаар"]];
    return `<div class="item-cfg">
      <div class="edit-row" style="border:none;padding:0">
        <input type="text" value="${esc(it.name)}" onchange="setItemName('${it.id}',this.value)">
        <button class="icon-btn" onclick="delItem('${it.id}')">Хасах</button>
      </div>
      <div class="cfg-row"><span class="cl">Юугаар бүртгэх</span>
        <select class="opt-sel" onchange="setTrack('${it.id}',this.value)">
          ${trackOpts.map(o=>`<option value="${o[0]}"${tr===o[0]?" selected":""}>${o[1]}</option>`).join("")}
        </select></div>
      ${tr==="sack"?`<div class="cfg-row"><span class="cl">1 шуудайд (ширхэг)</span>
        <input class="opt-sel" style="max-width:120px;text-align:right" type="number" inputmode="numeric" min="0" step="1"
               value="${it.perSack||0}" onchange="setPerSack('${it.id}',this.value)"></div>`:""}
      <div class="cfg-row"><span class="cl">Цалин бодох нэгж</span>
        <select class="opt-sel" onchange="setPayUnit('${it.id}',this.value)">
          ${payOpts.map(o=>`<option value="${o[0]}"${pu===o[0]?" selected":""}>${o[1]}</option>`).join("")}
        </select></div>
      <div class="cfg-row"><span class="cl">Борлуулах үнэ (₮/${uShort(mu)})</span>
        <input class="opt-sel" style="max-width:130px;text-align:right" type="number" inputmode="decimal"
               value="${it.price||0}" onchange="setItemPrice('${it.id}',this.value)"></div>
      <div class="cfg-row"><span class="cl">Гаднаас авах үнэ (₮/${uShort(mu)})</span>
        <input class="opt-sel" style="max-width:130px;text-align:right" type="number" inputmode="decimal"
               value="${it.buyPrice||0}" onchange="setItemBuyPrice('${it.id}',this.value)"></div>
    </div>`;
  }).join("") : `<div class="empty">Бараа нэмээгүй байна</div>`;
}
export function setItemName(id,v){ const it=db.items.find(i=>i.id===id); if(it){ it.name=v.trim()||it.name; save(); renderItems(); } }
export function setItemPrice(id,v){ const it=db.items.find(i=>i.id===id); if(it){ it.price=f(v); save(); } }
export function setItemBuyPrice(id,v){ const it=db.items.find(i=>i.id===id); if(it){ it.buyPrice=f(v); save(); } }
export function setPerSack(id,v){ const it=db.items.find(i=>i.id===id); if(it){ it.perSack=int(v); save(); renderItems(); } }
export function setTrack(id,v){
  const it=db.items.find(i=>i.id===id); if(!it) return;
  it.track=v;
  if(v==="kg") it.payUnit="kg";
  else if(v==="pcs"||v==="sack") it.payUnit="pcs";
  if(v==="sack" && !it.perSack) it.perSack=0;
  save(); renderItems();
}
export function setPayUnit(id,v){ const it=db.items.find(i=>i.id===id); if(it){ it.payUnit=v; save(); renderItems(); } }
export function addItem(){
  if(!requireOnline()) return;
  const n=$("newItemName").value.trim();
  if(!n){ toast("Барааны нэрийг бичнэ үү"); return; }
  db.items.push({id:uid(),name:n,track:"both",payUnit:"kg",price:0,buyPrice:0,defRate:0,perSack:0,fridges:[1,2]});
  $("newItemName").value=""; save(); renderItems(); toast(n+" нэмэгдлээ");
}
export function delItem(id){
  if(!requireOnline()) return;
  if(!confirm(itemName(id)+" -г жагсаалтаас хасах уу?")) return;
  const used=db.log.some(e=>e.item===id);
  if(used) db.items.find(i=>i.id===id).hidden=true;   /* хуучин бүртгэл хэвээр үлдэнэ */
  else db.items=db.items.filter(i=>i.id!==id);
  save(); renderItems(); toast("Хаслаа");
}

/* ---------- Хөргүүрийн ангилал ---------- */
export function openFridgeItems(){ state.fiFridge=1; renderFi(); show("scrFridgeItems"); }
export function setFiFridge(id,btn){
  state.fiFridge=id;
  document.querySelectorAll("#fiSeg button").forEach(b=>b.classList.remove("on"));
  btn.classList.add("on"); renderFi();
}
export function renderFi(){
  $("fiBtn1").textContent=fridgeName(1);
  $("fiBtn2").textContent=fridgeName(2);
  const items=liveItems();
  $("fiList").innerHTML = items.length ? items.map(it=>{
    const on=(it.fridges||[1,2]).indexOf(state.fiFridge)>=0;
    return `<div class="pick"><button type="button" class="check-row${on?" on":""}" onclick="toggleFi('${it.id}')">
      <span class="tick">✓</span><span>${esc(it.name)}</span></button></div>`;
  }).join("") : `<div class="empty">Бараа нэмээгүй байна</div>`;
}
export function toggleFi(id){
  const it=db.items.find(i=>i.id===id); if(!it) return;
  it.fridges=it.fridges||[];
  const i=it.fridges.indexOf(state.fiFridge);
  if(i>=0) it.fridges.splice(i,1); else it.fridges.push(state.fiFridge);
  save(); renderFi();
}
export function allFi(on){
  liveItems().forEach(it=>{
    it.fridges=it.fridges||[];
    const i=it.fridges.indexOf(state.fiFridge);
    if(on && i<0) it.fridges.push(state.fiFridge);
    if(!on && i>=0) it.fridges.splice(i,1);
  });
  save(); renderFi();
}

/* ---------- Ажилчид ---------- */
export function openWorkers(){ renderWorkers(); show("scrWorkers"); }
export function renderWorkers(){
  const ws=liveWorkers();
  $("workersEdit").innerHTML = ws.length ? ws.map(w=>{
    const fixed=w.payType==="fixed";
    return `<div class="item-cfg">
      <div class="edit-row" style="border:none;padding:0">
        <input type="text" value="${esc(w.name)}" onchange="setWorkerName('${w.id}',this.value)">
        <button class="icon-btn" onclick="delWorker('${w.id}')">Хасах</button>
      </div>
      <button type="button" class="check-row${fixed?" on":""}" onclick="toggleWorkerFixed('${w.id}')">
        <span class="tick">✓</span><span>Тогтмол цалинтай</span></button>
      ${fixed?`<div class="cfg-row"><span class="cl">Нэг өдрийн хөлс</span>
        <input class="opt-sel" style="max-width:150px;text-align:right" type="number" inputmode="decimal"
               value="${w.salary||0}" onchange="setWorkerSalary('${w.id}',this.value)"></div>
      <div class="tbl-note">Ажилласан өдөр тутамд энэ дүн бодогдоно. Урьдчилгаа, олгосон цалинг Цалин хэсгээс бүртгэнэ.</div>`:""}
    </div>`;
  }).join("") : `<div class="empty">Ажилчин нэмээгүй байна</div>`;
}
export function setWorkerName(id,v){ const w=db.workers.find(x=>x.id===id); if(w){ w.name=v.trim()||w.name; save(); renderWorkers(); } }
export function toggleWorkerFixed(id){
  const w=db.workers.find(x=>x.id===id); if(!w) return;
  w.payType = w.payType==="fixed" ? "piece" : "fixed";
  save(); renderWorkers();
}
export function setWorkerSalary(id,v){ const w=db.workers.find(x=>x.id===id); if(w){ w.salary=f(v); save(); } }

export function addWorker(){
  if(!requireOnline()) return;
  const n=$("newWorkerName").value.trim();
  if(!n){ toast("Ажилчны нэрийг бичнэ үү"); return; }
  const rates={}; db.items.forEach(i=>rates[i.id]=+i.defRate||0);
  db.workers.push({id:uid(),name:n,rates,payType:"piece",salary:0});
  $("newWorkerName").value=""; save(); renderWorkers(); toast(n+" нэмэгдлээ");
}
export function delWorker(id){
  if(!requireOnline()) return;
  if(!confirm(workerName(id)+" -г хасах уу?")) return;
  const used=db.log.some(e=>e.worker===id) || db.receipts.some(r=>r.issuer===id);
  if(used) db.workers.find(w=>w.id===id).hidden=true;  /* цалингийн түүх хэвээр үлдэнэ */
  else db.workers=db.workers.filter(w=>w.id!==id);
  if(db.lastIssuer===id) db.lastIssuer=null;
  save(); renderWorkers(); toast("Хаслаа");
}

/* ---------- Тариф ---------- */
export function openRates(){
  state.rateWorker=null;
  $("sel_rate").innerHTML=selectHTML("rate",liveWorkers(),null,"Ажилчнаа сонгоно уу");
  $("rateCard").style.display="none";
  show("scrRates");
}
onChoose.rate = id => pickRateWorker(id);
export function pickRateWorker(id){
  state.rateWorker=id;
  const w=db.workers.find(x=>x.id===id)||{};
  $("sel_rate").innerHTML=selectHTML("rate",liveWorkers(),id,"Ажилчнаа сонгоно уу");
  $("rateWho").textContent = w.payType==="fixed"
    ? workerName(id)+" — тогтмол цалинтай, тариф ашиглагдахгүй"
    : workerName(id)+" — нэгж тутмын хөлс";
  $("ratesEdit").innerHTML = liveItems().map(it=>`
    <div class="edit-row"><span class="nm">${esc(it.name)}<small>₮ / ${uLabel(payUnitOf(it.id))}</small></span>
      <input type="number" inputmode="decimal" style="max-width:130px" value="${rateOf(id,it.id)}"
             onchange="setRate('${id}','${it.id}',this.value)"></div>`).join("")
    || `<div class="empty">Бараа нэмээгүй байна</div>`;
  $("rateCard").style.display="block";
}
export function setRate(wid,iid,v){
  const w=db.workers.find(x=>x.id===wid); if(!w) return;
  w.rates=w.rates||{}; w.rates[iid]=f(v); save();
}

/* ---------- Харилцагч ----------
   Байгууллага, хувь хүн хоёр тусдаа бүлэг. Нэр дээр нь дарвал доошоо
   задарч, тэндээсээ шинийг нэмэх, хуучныг хасах боломжтой.
   Гаргах, Худалдан авах дээр шинээр бичсэн хувь хүн энд өөрөө орж ирнэ. */
export function openPartners(){ state.partyOpen=null; renderPartners(); show("scrPartners"); }
export function togglePartyGroup(k){
  state.partyOpen = state.partyOpen===k ? null : k;
  renderPartners();
}

function groupHead(key,title,count,open){
  return `<button type="button" class="exp-head" onclick="togglePartyGroup('${key}')">
    <span class="exp-arrow">${open?"▾":"▸"}</span>
    <span class="exp-main">${title}<small>${count} бүртгэлтэй</small></span>
    <span class="exp-val">${open?"":"›"}</span></button>`;
}

export function renderPartners(){
  db.persons = db.persons || [];
  const open=state.partyOpen;
  let h=groupHead("org","Байгууллага",db.partners.length,open==="org");
  if(open==="org"){
    h+=`<div class="exp-body">`;
    h+= db.partners.length ? db.partners.map(p=>`
      <div class="edit-row"><span class="nm">${esc(p.name)}
        ${(p.reg||p.phone)?`<small>${esc([p.reg,p.phone].filter(Boolean).join(" · "))}</small>`:""}</span>
        <button class="icon-btn" onclick="delPartner('${p.id}')">Хасах</button></div>`).join("")
      : `<div class="empty">Байгууллага нэмээгүй байна</div>`;
    h+=`<div class="add-row" style="display:block;margin-top:12px">
      <input type="text" id="npName" placeholder="Байгууллагын нэр" style="width:100%;margin-bottom:9px">
      <input type="text" id="npReg" placeholder="Регистрийн дугаар" style="width:100%;margin-bottom:9px">
      <input type="tel"  id="npPhone" placeholder="Утас" style="width:100%;margin-bottom:12px">
      <button class="btn btn-in btn-sm" onclick="addPartner()">Нэмэх</button></div></div>`;
  }
  h+=groupHead("person","Хувь хүн",db.persons.length,open==="person");
  if(open==="person"){
    h+=`<div class="exp-body">`;
    h+= db.persons.length ? db.persons.map(p=>`
      <div class="edit-row"><span class="nm">${esc(p.name)}
        ${p.phone?`<small>${esc(p.phone)}</small>`:""}</span>
        <button class="icon-btn" onclick="delPerson('${p.id}')">Хасах</button></div>`).join("")
      : `<div class="empty">Хувь хүн нэмээгүй байна.<br>Гаргах дээр бичсэн хүн энд өөрөө нэмэгдэнэ.</div>`;
    h+=`<div class="add-row" style="display:block;margin-top:12px">
      <input type="text" id="npPersonName" placeholder="Хувь хүний нэр" style="width:100%;margin-bottom:9px">
      <input type="tel"  id="npPersonPhone" placeholder="Утас" style="width:100%;margin-bottom:12px">
      <button class="btn btn-in btn-sm" onclick="addPerson()">Нэмэх</button></div></div>`;
  }
  $("partyBox").innerHTML=h;
}
export function addPartner(){
  if(!requireOnline()) return;
  const n=$("npName").value.trim();
  if(!n){ toast("Байгууллагын нэрийг бичнэ үү"); return; }
  db.partners.push({id:uid(),name:n,reg:$("npReg").value.trim(),phone:$("npPhone").value.trim()});
  save(); renderPartners(); toast(n+" нэмэгдлээ");
}
export function delPartner(id){
  if(!requireOnline()) return;
  const p=db.partners.find(x=>x.id===id);
  if(!p || !confirm(p.name+" -г хасах уу?")) return;
  db.partners=db.partners.filter(x=>x.id!==id);
  save(); renderPartners(); toast("Хаслаа");
}
export function addPerson(){
  if(!requireOnline()) return;
  const n=$("npPersonName").value.trim();
  if(!n){ toast("Хувь хүний нэрийг бичнэ үү"); return; }
  db.persons=db.persons||[];
  if(db.persons.some(x=>x.name.toLowerCase()===n.toLowerCase())){ toast(n+" аль хэдийн бүртгэлтэй байна"); return; }
  db.persons.push({id:uid(),name:n,phone:$("npPersonPhone").value.trim()});
  save(); renderPartners(); toast(n+" нэмэгдлээ");
}
export function delPerson(id){
  if(!requireOnline()) return;
  const p=(db.persons||[]).find(x=>x.id===id);
  if(!p) return;
  const used = db.receipts.some(r=>r.buyer && r.buyer.pid===id)
            || db.purchases.some(x=>x.supplier && x.supplier.pid===id);
  const msg = used
    ? p.name+" -г жагсаалтаас хасах уу?\nӨмнө гарсан баримт, өглөг авлага хэвээр үлдэнэ."
    : p.name+" -г хасах уу?";
  if(!confirm(msg)) return;
  db.persons=db.persons.filter(x=>x.id!==id);
  save(); renderPartners(); toast("Хаслаа");
}

/* ---------- Байгууллагын мэдээлэл ---------- */
export function openCompany(){
  const c=db.company||{};
  $("coName").value=c.name||"";   $("coPhone").value=c.phone||"";
  $("coReg").value=c.reg||"";     $("coBank").value=c.bank||"";
  $("coAccount").value=c.account||""; $("coAccName").value=c.accountName||"";
  show("scrCompany");
}
export function saveCompany(){
  if(!requireOnline()) return;
  db.company={
    name:$("coName").value.trim(), phone:$("coPhone").value.trim(), reg:$("coReg").value.trim(),
    bank:$("coBank").value.trim(), account:$("coAccount").value.trim(), accountName:$("coAccName").value.trim()
  };
  save(); toast("Хадгаллаа");
}

/* ---------- Код ---------- */
export function openCodes(){ $("pinWorker").value=db.pin; $("pinAdmin").value=db.adminPin; show("scrCodes"); }
export function savePins(){
  if(!requireOnline()) return;
  const p=$("pinWorker").value.trim(), a=$("pinAdmin").value.trim();
  if(!/^\d{4}$/.test(p)||!/^\d{4}$/.test(a)){ toast("Код 4 оронтой тоо байх ёстой"); return; }
  if(p===a){ toast("Хоёр код өөр байх ёстой"); return; }
  db.pin=p; db.adminPin=a; save(); toast("Код солигдлоо");
}

/* ---------- Нөөцлөх ----------
   Энэ хэсэгт бүх мэдээлэл ил гарах бөгөөд устгах товч ч бий тул
   тусдаа кодоор хамгаална. Код нь зөвхөн Firebase дээр байдаг. */
export function openBackup(){
  if(!requireOnline()) return;
  const v=prompt("Нөөцлөх хэсгийн код");
  if(v===null) return;
  if(v.trim()!==getBackupPin()){ toast("Код буруу байна"); return; }
  $("bkText").value=JSON.stringify(db); show("scrBackup");
}
export function changeBackupPin(){
  if(!requireOnline()) return;
  const v=prompt("Шинэ код — 4 оронтой тоо", getBackupPin());
  if(v===null) return;
  const n=v.trim();
  if(!/^\d{4}$/.test(n)){ toast("Код 4 оронтой тоо байх ёстой"); return; }
  setBackupPin(n); toast("Код солигдлоо");
}
export function copyBackup(){
  const t=$("bkText"); t.select(); t.setSelectionRange(0,999999);
  try{ document.execCommand("copy"); toast("Хуулагдлаа"); }
  catch(e){ toast("Гараар сонгож хуулна уу"); }
}
export function restoreBackup(){
  if(!requireOnline()) return;
  let d;
  try{ d=JSON.parse($("bkText").value); }
  catch(e){ toast("Нөөцийн бичвэр буруу байна"); return; }
  if(!d || !d.items || !d.workers){ toast("Нөөцийн бичвэр буруу байна"); return; }
  if(!confirm("Одоогийн мэдээллийг энэ нөөцөөр солих уу?")) return;
  replaceDb(d); saveLocal(); pushSettings();
  db.log.forEach(e=>fbSet("log",e.id,e));
  db.receipts.forEach(r=>fbSet("receipts",r.id,r));
  db.purchases.forEach(p=>fbSet("purchases",p.id,p));
  db.audits.forEach(a=>fbSet("audits",a.id,a));
  db.settlements.forEach(x=>fbSet("settlements",x.id,x));
  toast("Сэргээлээ"); renderHome();
}
export function wipeAll(){
  if(!requireOnline()) return;
  if(!confirm("Бүх орлого зарлага, баримт, цалингийн бүртгэл устана. Итгэлтэй байна уу?")) return;
  if(!confirm("Дахин баталгаажуулна уу — устгасан бүртгэл сэргэхгүй.")) return;
  const old={ log:db.log.slice(), receipts:db.receipts.slice(),
              purchases:db.purchases.slice(), audits:db.audits.slice(), settlements:db.settlements.slice(),
              wagepays:db.wagepays.slice(), works:db.works.slice() };
  db.log=[]; db.receipts=[]; db.purchases=[]; db.audits=[]; db.settlements=[]; db.wagepays=[]; db.works=[];
  saveLocal(); pushSettings();
  old.log.forEach(e=>fbDel("log",e.id));
  old.receipts.forEach(r=>fbDel("receipts",r.id));
  old.purchases.forEach(p=>fbDel("purchases",p.id));
  old.audits.forEach(a=>fbDel("audits",a.id));
  old.settlements.forEach(x=>fbDel("settlements",x.id));
  old.wagepays.forEach(x=>fbDel("wagepays",x.id));
  old.works.forEach(x=>fbDel("works",x.id));
  toast("Бүртгэл цэвэрлэгдлээ");
}

export function openDevice(){
  if(!requireOnline()) return;
  const box=$("devUid");
  if(!box){ toast("Энэ хэсэг ачаалагдаагүй байна · index.html шинэчлэгдээгүй"); return; }
  const uid=window.__uid;
  box.textContent = uid || "Дугаар хараахан гараагүй байна · сервертэй холбогдохыг хүлээнэ үү";
  show("scrDevice");
}
export function copyUid(){
  const uid=window.__uid;
  if(!uid){ toast("Дугаар хараахан гараагүй байна"); return; }
  const ta=document.createElement("textarea");
  ta.value=uid; ta.style.position="fixed"; ta.style.opacity="0";
  document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0,999999);
  try{ document.execCommand("copy"); toast("Хуулагдлаа"); }
  catch(e){ toast("Гараар сонгож хуулна уу"); }
  document.body.removeChild(ta);
}
