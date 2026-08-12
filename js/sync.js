/* Firebase хадгалалт. Модулиуд зөвхөн энэ файлаар дамжуулж сервертэй харьцана. */
import { db, saveLocal, normalize } from './state.js';
import { refreshActive } from './router.js';

let ready=false, syncState="local";

export function syncText(){
  if(syncState==="err") return "Сүлжээний тохиргоо алдаатай · утсанд хадгалж байна";
  if(syncState==="ok")  return navigator.onLine ? "Сервертэй холбогдсон" : "Офлайн · сүлжээ ирэхэд өөрөө нийлнэ";
  return "Зөвхөн энэ утсанд хадгалж байна";
}
export function setSyncState(st){
  syncState=st;
  const el=document.getElementById("syncLine");
  if(el) el.textContent=syncText();
}
window.setSyncState=setSyncState;

export function fbSet(coll,id,data){
  const F=window.FB;
  if(!ready||!F||!id) return;
  F.setDoc(F.doc(F.fs,coll,id), JSON.parse(JSON.stringify(data))).catch(e=>console.error("set",coll,e));
}
export function fbDel(coll,id){
  const F=window.FB;
  if(!ready||!F||!id) return;
  F.deleteDoc(F.doc(F.fs,coll,id)).catch(e=>console.error("del",coll,e));
}

/* Ховор өөрчлөгддөг тохиргоог нэг документэд, бүртгэлүүдийг тус тусад нь
   хадгалдаг — хоёр хүн зэрэг ажиллахад бие биенийхээ бичлэгийг дарж бичихгүй. */
export function pushSettings(){
  fbSet("app","config",{
    pin:db.pin, adminPin:db.adminPin, company:db.company, fridges:db.fridges,
    receiptNo:db.receiptNo, purchaseNo:db.purchaseNo, lastIssuer:db.lastIssuer||null
  });
  fbSet("app","items",   {list:db.items});
  fbSet("app","workers", {list:db.workers});
  fbSet("app","partners",{list:db.partners});
}
/* Тохиргоо өөрчлөгдөх бүрд дуудна */
export function save(){ saveLocal(); pushSettings(); }

export function startSync(){
  const F=window.FB;
  if(!F||ready) return;
  ready=true; setSyncState("ok");

  F.onSnapshot(F.doc(F.fs,"app","config"), snap=>{
    if(!snap.exists()){ pushSettings(); return; }
    const d=snap.data();
    db.pin=d.pin||db.pin; db.adminPin=d.adminPin||db.adminPin;
    db.company=d.company||db.company; db.fridges=d.fridges||db.fridges;
    db.receiptNo=d.receiptNo||0; db.purchaseNo=d.purchaseNo||0;
    db.lastIssuer=d.lastIssuer||null;
    normalize(); saveLocal(); refreshActive();
  }, e=>{ console.error(e); setSyncState("err"); });

  [["items","items"],["workers","workers"],["partners","partners"]].forEach(([doc,field])=>{
    F.onSnapshot(F.doc(F.fs,"app",doc), snap=>{
      if(!snap.exists()) return;
      db[field]=snap.data().list||[];
      normalize(); saveLocal(); refreshActive();
    }, e=>console.error(e));
  });

  ["log","receipts","purchases","audits","settlements"].forEach(coll=>{
    F.onSnapshot(F.collection(F.fs,coll), snap=>{
      db[coll]=snap.docs.map(d=>d.data());
      normalize(); saveLocal(); refreshActive();
    }, e=>console.error(e));
  });
}
window.startSync=startSync;

window.addEventListener("online", ()=>setSyncState(syncState));
window.addEventListener("offline",()=>setSyncState(syncState));

/* Баримтын дугаарыг transaction-оор нэмнэ — хоёр хүн зэрэг
   баримт гаргасан ч дугаар давхцахгүй. */
export async function nextNo(field){
  const F=window.FB;
  if(ready&&F){
    try{
      return await F.runTransaction(F.fs, async tx=>{
        const ref=F.doc(F.fs,"app","config");
        const snap=await tx.get(ref);
        const n=(((snap.data()||{})[field])||db[field]||0)+1;
        tx.set(ref,{[field]:n},{merge:true});
        return n;
      });
    }catch(e){ console.error("nextNo",e); }
  }
  return (db[field]||0)+1;
}
