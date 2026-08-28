/* Excel рүү экспортлох.
   Хяналтын самбараас огноо сонгоод дарахад дараах хуудсууд бүхий нэг
   Excel файл татагдана:
     1) Хөргүүр тус бүрийн сонгосон өдрийн хөдөлгөөн (эхний үлдэгдэл →
        орсон → гарсан → эцсийн үлдэгдэл) — dash.js-тэй ижил логик.
     2) Авлага — харилцагч тус бүрийн нийт баримт, төлсөн, үлдэгдэл.
     3) Өглөг — нийлүүлэгч тус бүрийн нийт баримт, өгсөн, үлдэгдэл.
     4) Бараа, үнэ — борлуулах/авах үнэ, цалингийн үндсэн тариф.
     5) Ажилчид, тариф — ажилчин тус бүрийн төрөл, өдрийн цалин, бараа
        тус бүр дээрх нэгж тутмын хөлс.
     6) Харилцагч — байгууллага, хувь хүний жагсаалт.
   Авлага/өглөг/бараа/ажилчид/харилцагч нь тухайн өдрөөр шүүгдэхгүй,
   одоогийн бүх түүх, бүртгэлийг харуулна. */
import { db } from './state.js';
import { dateStr, itemName, mainUnitOf, payUnitOf, uShort, rateOf,
         liveItems, liveWorkers, num, isoStr } from './util.js';
import { toast } from './ui.js';

/* ===================== 1) Хөргүүрийн өдрийн хөдөлгөөн ===================== */

/* Сонгосон өдрийн эхлэхээс өмнөх үлдэгдлийг барааны жагсаалтаар нэг удаа бодно */
function openingMap(fid, dayStart, ids){
  const map={};
  ids.forEach(id=>{ map[id]={kg:0,pcs:0}; });
  db.log.forEach(e=>{
    if(e.fridge!==fid || e.ts>=dayStart) return;
    const c=map[e.item];
    if(!c) return;
    const s = e.action==="in" ? 1 : -1;
    c.kg+=s*(e.kg||0); c.pcs+=s*(e.pcs||0);
  });
  Object.keys(map).forEach(id=>{ map[id].kg=num(map[id].kg); });
  return map;
}
function qtyOfUnit(kg,pcs,id){ return mainUnitOf(id)==="pcs" ? pcs : num(kg); }

const FRIDGE_HEADER=["Огноо","Бараа","Нэгж","Эхний үлдэгдэл","Орсон","Гарсан","Эцсийн үлдэгдэл"];

/* Нэг хөргүүрийн тухайн өдрийн мөрүүд */
function fridgeRows(fid, dayIso){
  const dayStart=new Date(dayIso+"T00:00:00").getTime();
  const dayEnd  =new Date(dayIso+"T23:59:59.999").getTime();
  const logRows=db.log.filter(e=>e.fridge===fid && e.ts>=dayStart && e.ts<=dayEnd);
  if(!logRows.length) return [FRIDGE_HEADER];

  const items={};
  logRows.forEach(e=>{
    const c=items[e.item]=items[e.item]||{ikg:0,ipcs:0,okg:0,opcs:0};
    if(e.action==="in"){ c.ikg+=(e.kg||0); c.ipcs+=(e.pcs||0); }
    else{ c.okg+=(e.kg||0); c.opcs+=(e.pcs||0); }
  });
  const ids=Object.keys(items);
  const opening=openingMap(fid, dayStart, ids);
  const label=dateStr(new Date(dayStart));

  const rows=[FRIDGE_HEADER];
  ids.forEach(id=>{
    const c=items[id];
    const open=opening[id]||{kg:0,pcs:0};
    const close={kg:num(open.kg+c.ikg-c.okg), pcs:open.pcs+c.ipcs-c.opcs};
    rows.push([
      label,
      itemName(id),
      uShort(mainUnitOf(id)),
      qtyOfUnit(open.kg,open.pcs,id),
      qtyOfUnit(c.ikg,c.ipcs,id),
      qtyOfUnit(c.okg,c.opcs,id),
      qtyOfUnit(close.kg,close.pcs,id)
    ]);
  });
  return rows;
}

/* ===================== 2)/3) Авлага, Өглөг ===================== */

/* debt.js-тэй ижил бүлэглэлт — гэхдээ энд огноогоор шүүхгүй, бүх
   түүхэн бүртгэлээр нэгтгэнэ (экспортлох мөчийн бодит үлдэгдэл). */
function debtGroupKey(who){ return (who&&who.pid) ? who.pid : ("name:"+((who&&who.name)||"—")); }

function debtRows(kind){
  const isDue = kind==="due";
  const src = isDue ? (db.receipts||[]) : (db.purchases||[]);
  const groups={};
  src.forEach(r=>{
    const who=(isDue?r.buyer:r.supplier)||{name:"—"};
    const k=debtGroupKey(who);
    const g=groups[k]=groups[k]||{name:who.name||"—",docs:0,total:0,paid:0};
    g.docs++; g.total+=r.total||0;
  });
  (db.settlements||[]).forEach(x=>{
    if(x.kind!==kind) return;
    const k=x.pid || ("name:"+x.name);
    const g=groups[k]=groups[k]||{name:x.name||"—",docs:0,total:0,paid:0};
    g.paid+=x.amount||0;
  });

  const header=["Харилцагч","Баримтын тоо","Нийт дүн", isDue?"Авсан дүн":"Өгсөн дүн", "Үлдэгдэл"];
  const rows=[header];
  const list=Object.values(groups).map(g=>{
    const total=num(g.total), paid=num(g.paid);
    return {name:g.name, docs:g.docs, total, paid, rest:num(total-paid)};
  }).sort((a,b)=>b.rest-a.rest);
  list.forEach(g=>rows.push([g.name, g.docs, g.total, g.paid, g.rest]));
  if(!list.length) rows.push([isDue?"Авлага бүртгэгдээгүй байна":"Өглөг бүртгэгдээгүй байна","","","",""]);

  const totAll=list.reduce((s,g)=>s+g.total,0), paidAll=list.reduce((s,g)=>s+g.paid,0);
  if(list.length) rows.push(["Нийт","",num(totAll),num(paidAll),num(totAll-paidAll)]);
  return rows;
}

/* ===================== 4) Бараа, үнэ ===================== */

function itemsRows(){
  const header=["Бараа","Худалдааны нэгж","Борлуулах үнэ","Гаднаас авах үнэ","Цалингийн нэгж","Цалингийн үндсэн тариф"];
  const rows=[header];
  liveItems().forEach(it=>{
    rows.push([
      it.name,
      uShort(mainUnitOf(it.id)),
      num(+it.price||0),
      num(+it.buyPrice||0),
      uShort(payUnitOf(it.id)),
      num(+it.defRate||0)
    ]);
  });
  if(rows.length===1) rows.push(["Бараа нэмээгүй байна","","","","",""]);
  return rows;
}

/* ===================== 5) Ажилчид, тариф ===================== */

function workersRows(){
  const items=liveItems();
  const header=["Ажилчин","Төрөл","Өдрийн цалин", ...items.map(it=>`${it.name} (${uShort(payUnitOf(it.id))})`)];
  const rows=[header];
  liveWorkers().forEach(w=>{
    const fixed=w.payType==="fixed";
    const row=[w.name, fixed?"Тогтмол цалинтай":"Нэгж тутмын хөлс", fixed?num(+w.salary||0):""];
    items.forEach(it=>{ row.push(fixed ? "" : num(rateOf(w.id,it.id))); });
    rows.push(row);
  });
  if(rows.length===1) rows.push(["Ажилчин нэмээгүй байна","","", ...items.map(()=>"")]);
  return rows;
}

/* ===================== 6) Харилцагч ===================== */

function partnersRows(){
  const rows=[];
  rows.push(["Байгууллага","",""]);
  rows.push(["Нэр","Регистр","Утас"]);
  const partners=db.partners||[];
  if(partners.length) partners.forEach(p=>rows.push([p.name, p.reg||"", p.phone||""]));
  else rows.push(["Байгууллага нэмээгүй байна","",""]);

  rows.push(["","",""]);
  rows.push(["Хувь хүн","",""]);
  rows.push(["Нэр","Утас",""]);
  const persons=db.persons||[];
  if(persons.length) persons.forEach(p=>rows.push([p.name, p.phone||"", ""]));
  else rows.push(["Хувь хүн нэмээгүй байна","",""]);
  return rows;
}

/* Хуудасны нэр 31 тэмдэгтээс ихгүй, "/\?*[]:" тэмдэгт агуулж болохгүй байх ёстой */
function safeSheetName(name){
  return String(name||"Хуудас").replace(/[\\/?*\[\]:]/g,"·").slice(0,31) || "Хуудас";
}

function addSheet(F, wb, used, name, rows, colWidths){
  const ws=F.utils.aoa_to_sheet(rows);
  if(colWidths) ws['!cols']=colWidths;
  let sheetName=safeSheetName(name);
  if(used[sheetName]){ used[sheetName]++; sheetName=(sheetName+" "+used[sheetName]).slice(0,31); }
  else used[sheetName]=1;
  F.utils.book_append_sheet(wb, ws, sheetName);
}

export function exportDayXlsx(){
  const F=window.XLSX;
  if(!F){ toast("Excel сан ачаалагдсангүй · интернэт холболтоо шалгаад дахин оролдоно уу"); return; }

  const el=document.getElementById("dashXlsxDate");
  const dIso = (el && el.value) || isoStr();

  const wb=F.utils.book_new();
  const used={};

  /* 1) Хөргүүр тус бүрийн өдрийн хөдөлгөөн */
  (db.fridges||[]).forEach(fr=>{
    addSheet(F, wb, used, fr.name, fridgeRows(fr.id, dIso),
      [{wch:12},{wch:24},{wch:8},{wch:14},{wch:12},{wch:12},{wch:14}]);
  });

  /* 2)-3) Авлага, өглөг */
  addSheet(F, wb, used, "Авлага", debtRows("due"),
    [{wch:26},{wch:14},{wch:14},{wch:14},{wch:14}]);
  addSheet(F, wb, used, "Өглөг", debtRows("owe"),
    [{wch:26},{wch:14},{wch:14},{wch:14},{wch:14}]);

  /* 4) Бараа, үнэ */
  addSheet(F, wb, used, "Бараа, үнэ", itemsRows(),
    [{wch:22},{wch:16},{wch:16},{wch:16},{wch:16},{wch:20}]);

  /* 5) Ажилчид, тариф */
  const itemCount=liveItems().length;
  addSheet(F, wb, used, "Ажилчид", workersRows(),
    [{wch:20},{wch:18},{wch:14}, ...Array(itemCount).fill({wch:16})]);

  /* 6) Харилцагч */
  addSheet(F, wb, used, "Харилцагч", partnersRows(),
    [{wch:24},{wch:16},{wch:16}]);

  F.writeFile(wb, `hurguur_${dIso}.xlsx`);
  toast("Excel файл татагдлаа");
}
