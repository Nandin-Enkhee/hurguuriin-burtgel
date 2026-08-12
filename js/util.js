/* Форматлах ба нэгжийн туслах функцууд. state.js-ээс л хамаарна. */
import { db } from './state.js';

export function esc(s){
  return String(s==null?"":s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
export function f(v){ return parseFloat(v)||0; }
export function int(v){ return parseInt(v)||0; }
export function num(n){ return Math.round(n*100)/100; }
export function money(n){ return Math.round(n).toLocaleString("en-US").replace(/,/g," ")+"₮"; }

const p2 = n => ("0"+n).slice(-2);
export function dateStr(d){ d=d||new Date(); return d.getFullYear()+"."+(d.getMonth()+1)+"."+d.getDate(); }
export function timeStr(d){ d=d||new Date(); return p2(d.getHours())+":"+p2(d.getMinutes()); }
export function isoStr(d){ d=d||new Date(); return d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate()); }
export function isoMonth(d){ d=d||new Date(); return d.getFullYear()+"-"+p2(d.getMonth()+1); }
export function dayKey(ts){ const d=new Date(ts); return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); }
export function monthKey(ts){ const d=new Date(ts); return d.getFullYear()+"-"+(d.getMonth()+1); }
export function dayKeyOfIso(v){ const a=v.split("-").map(Number); return a[0]+"-"+a[1]+"-"+a[2]; }
export function monthKeyOfIso(v){ const a=v.split("-").map(Number); return a[0]+"-"+a[1]; }
export function fullDateTime(ts){
  const d=new Date(ts);
  return d.getFullYear()+"."+(d.getMonth()+1)+"."+d.getDate()+" "+timeStr(d);
}
/* Сонгосон огноог өнөөдрийн цагтай нийлүүлж timestamp болгоно */
export function tsOfIso(iso){
  const now=new Date(), a=(iso||isoStr()).split("-").map(Number);
  return new Date(a[0],(a[1]||1)-1,a[2]||1,now.getHours(),now.getMinutes(),now.getSeconds(),now.getMilliseconds()).getTime();
}

/* ---------- Бараа, нэгж ---------- */
export function itemOf(id){ return db.items.find(i=>i.id===id) || {track:"both",payUnit:"kg",name:"— устгасан —"}; }
export function itemName(id){ return itemOf(id).name; }
export function itemPrice(id){ return +itemOf(id).price||0; }
export function itemBuyPrice(id){ return +itemOf(id).buyPrice||0; }
export function trackOf(id){ return itemOf(id).track||"both"; }
export function isSack(id){ return trackOf(id)==="sack"; }
export function perSackOf(id){ return int(itemOf(id).perSack); }
export function payUnitOf(id){
  const t=trackOf(id);
  if(t==="pcs"||t==="sack") return "pcs";
  if(t==="kg") return "kg";
  return itemOf(id).payUnit || "kg";
}
export function mainUnitOf(id){ const t=trackOf(id); return (t==="pcs"||t==="sack") ? "pcs" : "kg"; }
export function hasKg(id){ const t=trackOf(id); return t!=="pcs" && t!=="sack"; }
export function hasPcs(id){ return trackOf(id)!=="kg"; }
export function uLabel(u){ return u==="pcs" ? "ширхэг" : "кг"; }
export function uShort(u){ return u==="pcs" ? "ш" : "кг"; }

export function sackNote(id,pcs){
  const per=perSackOf(id);
  if(!isSack(id)||!per||!pcs) return "";
  const whole=Math.floor(pcs/per), left=pcs-whole*per;
  return whole+" шуудай"+(left?" + "+left+" ш":"");
}
export function qtyLine(kg,pcs,id){
  const parts=[];
  if(hasKg(id)&&kg) parts.push(num(kg)+" кг");
  if(hasPcs(id)&&pcs) parts.push(pcs+" ш");
  if(!parts.length) return "0";
  const sn=sackNote(id,pcs);
  return parts.join(" · ")+(sn?" ("+sn+")":"");
}

/* ---------- Ажилчид ---------- */
export function workerName(id){ const w=db.workers.find(x=>x.id===id); return w?w.name:"—"; }
export function liveItems(){ return db.items.filter(i=>!i.hidden); }
export function liveWorkers(){ return db.workers.filter(w=>!w.hidden); }
export function itemsOf(fid){ return liveItems().filter(i=>(i.fridges||[1,2]).indexOf(fid)>=0); }
export function fridgeName(id){ return ((db.fridges.find(x=>x.id===id))||{}).name || ""; }
export function rateOf(workerId,itemId){
  const w=db.workers.find(x=>x.id===workerId);
  if(w && w.rates && w.rates[itemId]!=null) return +w.rates[itemId];
  return +itemOf(itemId).defRate||0;
}

/* ---------- Үлдэгдэл ----------
   Үлдэгдлийг тусад нь хадгалахгүй, түүхээс тооцно.
   Ингэснээр буруу бичлэгийг устгахад үлдэгдэл өөрөө засагдана. */
export function stock(fridgeId,itemId,ignoreReceipt){
  let kg=0,pcs=0;
  db.log.forEach(e=>{
    if(e.fridge!==fridgeId || e.item!==itemId) return;
    if(ignoreReceipt && e.receipt===ignoreReceipt) return;
    const s = e.action==="in" ? 1 : -1;
    kg += s*(e.kg||0); pcs += s*(e.pcs||0);
  });
  return { kg:Math.max(0,num(kg)), pcs:Math.max(0,pcs) };
}

/* ---------- Баримтын мөр ---------- */
export function lQty(l){ return l.qty!=null ? l.qty : (l.kg||0); }
export function lUnit(l){ return l.unit || "kg"; }
export function lineSummary(doc){
  return doc.lines.map(l=>l.name+" "+lQty(l)+" "+uShort(lUnit(l))).join(", ");
}

/* ---------- Цалин ---------- */
export function qtyFor(e){ return payUnitOf(e.item)==="pcs" ? (e.pcs||0) : (e.kg||0); }
export function payFor(e){ return qtyFor(e)*rateOf(e.worker,e.item); }
