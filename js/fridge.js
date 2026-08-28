/* Хөргүүрийн үлдэгдэл ба өдрийн хөдөлгөөн */
import { db, state } from './state.js';
import { dateStr, dayKey, itemsOf, stock, qtyLine, esc, num,
         trackOf, mainUnitOf, fridgeName, sackNote } from './util.js';
import { $ } from './ui.js';
import { show, registerScreen } from './router.js';

export function openFridge(id){
  state.curFridge=id;
  renderFridge();
  show("scrFridge");
}
export function backToFridge(){ openFridge(state.curFridge); }

export function renderFridge(){
  const id=state.curFridge;
  $("frTitle").textContent=fridgeName(id);
  $("frDate").textContent=dateStr();
  const items=itemsOf(id);
  $("frList").innerHTML = items.length ? items.map(it=>{
    const s=stock(id,it.id);
    let main, sub="";
    if(mainUnitOf(it.id)==="pcs"){
      main=s.pcs+" <span style='font-size:14px;font-weight:600'>ширхэг</span>";
      const sn=sackNote(it.id,s.pcs);
      if(sn) sub=`<small>${sn}</small>`;
    }else{
      main=s.kg+" <span style='font-size:14px;font-weight:600'>кг</span>";
      if(trackOf(it.id)==="both") sub=`<small>${s.pcs} ширхэг</small>`;
    }
    return `<div class="item-row">
      <span class="item-name">${esc(it.name)}</span>
      <span class="item-val">${main}${sub}</span></div>`;
  }).join("") : `<div class="empty">Энэ хөргүүрт ангилал тохируулаагүй байна.<br>Тохиргоо → Хөргүүрийн ангилал хэсгээс нэмнэ үү.</div>`;
  renderMoves(id);
}

function renderMoves(fid){
  const dk=dayKey(Date.now());
  $("mvTitle").textContent="Өнөөдөр · "+dateStr();
  const res={};
  db.log.forEach(e=>{
    if(e.fridge!==fid || dayKey(e.ts)!==dk) return;
    if(!res[e.item]) res[e.item]={ikg:0,okg:0,ipcs:0,opcs:0};
    const r=res[e.item];
    if(e.action==="in"){ r.ikg+=(e.kg||0); r.ipcs+=(e.pcs||0); }
    else{ r.okg+=(e.kg||0); r.opcs+=(e.pcs||0); }
  });
  const items=itemsOf(fid).filter(it=>res[it.id]);
  $("mvList").innerHTML = items.length ? items.map(it=>{
    const r=res[it.id];
    return `<div class="mv-row"><span class="mn">${esc(it.name)}</span><span class="mv-nums">
      <span class="mv-in">+${qtyLine(r.ikg,r.ipcs,it.id)}</span> &nbsp;
      <span class="mv-out">−${qtyLine(r.okg,r.opcs,it.id)}</span></span></div>`;
  }).join("") : `<div class="empty">Өнөөдөр хөдөлгөөн бүртгэгдээгүй байна</div>`;
}
registerScreen("scrFridge", renderFridge);
