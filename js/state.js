/* Өгөгдлийн загвар ба орон нутгийн хадгалалт.
   Энэ файл өөр ямар ч модулиас хамаарахгүй — хамгийн доод давхарга. */

export const KEY = "hurguur_db_v4";
let memStore = null;

export function uid(){ return Math.random().toString(36).slice(2,9); }

export function defaults(){
  return {
    pin:"1234", adminPin:"9999", salaryPin:"5678", lastIssuer:null, lastRecorder:null, receiptNo:0, purchaseNo:0,
    company:{ name:"Дэлгэрэх Төв ХХК", phone:"", reg:"", bank:"", account:"", accountName:"" },
    fridges:[{id:1,name:"1-р хөргүүр"},{id:2,name:"2-р хөргүүр"}],
    items:[
      itemDefaults("Гүзээ",      "both"),
      itemDefaults("Шир",        "pcs"),
      itemDefaults("Толгой",     "pcs"),
      itemDefaults("Шийр",       "pcs"),
      itemDefaults("Зүрх",       "both"),
      itemDefaults("Нохой хоол", "kg"),
      itemDefaults("Гэдэс",      "sack")
    ],
    workers:[{id:uid(),name:"Ажилчин 1",rates:{},payType:"piece",salary:0}],
    partners:[], persons:[], receipts:[], purchases:[], log:[], audits:[],
    settlements:[], wagepays:[], works:[], attend:[]
  };
}
function itemDefaults(name,track){
  return { id:uid(), name, track,
           payUnit: track==="kg" ? "kg" : (track==="both" ? "kg" : "pcs"),
           price:0, buyPrice:0, defRate:0, perSack:0, fridges:[1,2] };
}

/* Бүх модуль энэ нэг объектыг хуваалцана */
export const db = defaults();

export function replaceDb(next){
  Object.keys(db).forEach(k=>{ delete db[k]; });
  Object.assign(db, next);
  normalize();
}

export function normalize(){
  db.partners   = db.partners   || [];
  db.persons    = db.persons    || [];   /* Гаргах, Худалдан авахад бичсэн хувь хүмүүс */
  db.receipts   = db.receipts   || [];
  db.purchases  = db.purchases  || [];
  db.audits     = db.audits     || [];
  db.log        = db.log        || [];
  db.settlements= db.settlements|| [];
  db.wagepays   = db.wagepays   || [];
  db.works      = db.works      || [];
  db.attend     = db.attend     || [];   /* тогтмол цалинтай ажилчдын ирц */
  db.items      = db.items      || [];
  db.workers    = db.workers    || [];
  db.receiptNo  = db.receiptNo  || 0;
  db.purchaseNo = db.purchaseNo || 0;
  db.salaryPin  = db.salaryPin  || "5678";
  db.company    = Object.assign({}, defaults().company, db.company || {});
  db.fridges    = (db.fridges && db.fridges.length) ? db.fridges : defaults().fridges;

  db.items.forEach(i=>{
    if(!i.fridges) i.fridges=[1,2];
    if(!i.track) i.track="both";
    if(i.track==="pcs"||i.track==="sack") i.payUnit="pcs";
    else if(i.track==="kg") i.payUnit="kg";
    else if(!i.payUnit) i.payUnit="kg";
    if(i.buyPrice==null) i.buyPrice=0;
    if(i.perSack==null) i.perSack=0;
  });
  db.workers.forEach(w=>{
    if(!w.payType) w.payType="piece";
    if(w.salary==null) w.salary=0;   /* тогтмол цалин — нэг өдрийн дүн */
    /* Хуучин ажилчин дээрх нэг удаагийн урьдчилгааг огноотой бичилт болгож шилжүүлнэ */
    if(w.hasAdvance && +w.advance>0){
      db.wagepays.push({id:uid(),ts:Date.now(),worker:w.id,kind:"advance",
                        amount:+w.advance,note:"Хуучин тохиргооноос шилжсэн"});
    }
    delete w.hasAdvance; delete w.advance;
  });
  db.receipts.forEach(r=>{ if(r.paid==null) r.paid=false; });
  db.purchases.forEach(p=>{ if(p.paid==null) p.paid=false; });
}

export function saveLocal(){
  const s = JSON.stringify(db);
  try{ localStorage.setItem(KEY,s); }catch(e){ memStore = s; }
}
export function loadLocal(){
  let s=null;
  try{ s=localStorage.getItem(KEY); }catch(e){ s=memStore; }
  if(!s) return;
  try{
    const d=JSON.parse(s);
    if(d && d.items && d.workers) replaceDb(d);
  }catch(e){}
}

/* Дэлгэц хооронд дамжих түр төлөв. Модуль бүр өөрийн талбарыг эзэмшинэ. */
export const state = {
  isAdmin:false,
  salaryUnlocked:false,
  curFridge:1,
  entry:{ items:{}, recorder:null, date:null },
  work:{ items:{}, worker:null, date:null },
  attend:{ date:null, workers:[] },
  cart:{ partner:null, partnerKind:null, issuer:null, items:{}, pcs:{}, per:{}, sacks:{}, editId:null },
  buy:{ date:null, fridge:1, supplier:null, supplierKind:null, items:{}, prices:{} },
  salary:{ period:"day", open:null, date:null, month:null },
  records:{ month:null, fridge:1, openDay:null },
  itemHist:{ item:null, from:null, to:null },
  dash:{ date:null, openOrg:null },
  debt:{ kind:"due", range:"month", month:null, date:null, search:"", show:"open", openOrg:null },
  rateWorker:null,
  partyOpen:null,
  fiFridge:1,
  receipt:{ current:null },
  busy:{ entry:false, buy:false, receipt:false, work:false, attend:false }
};
