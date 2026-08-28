/* Өдрийн хөдөлгөөнийг Excel рүү экспортлох.
   Хяналтын самбараас огноо сонгоод дарахад бүх хөргүүрийн тэр өдрийн
   орсон, гарсан хэмжээг хөргүүр тус бүрд нь тусдаа хуудас болгож нэг
   Excel файлаар татна. Тооцоо нь Хяналтын самбар (dash.js) дээрхтэй
   ижил логик: бараа тус бүрээр эхний үлдэгдэл → орсон → гарсан → эцсийн үлдэгдэл. */
import { db } from './state.js';
import { dateStr, itemName, mainUnitOf, uShort, num, isoStr } from './util.js';
import { toast } from './ui.js';

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

const HEADER=["Огноо","Бараа","Нэгж","Эхний үлдэгдэл","Орсон","Гарсан","Эцсийн үлдэгдэл"];

/* Нэг хөргүүрийн тухайн өдрийн мөрүүд — Excel хуудсанд шууд бичигдэнэ */
function fridgeRows(fid, dayIso){
  const dayStart=new Date(dayIso+"T00:00:00").getTime();
  const dayEnd  =new Date(dayIso+"T23:59:59.999").getTime();
  const logRows=db.log.filter(e=>e.fridge===fid && e.ts>=dayStart && e.ts<=dayEnd);
  if(!logRows.length) return [HEADER];

  const items={};
  logRows.forEach(e=>{
    const c=items[e.item]=items[e.item]||{ikg:0,ipcs:0,okg:0,opcs:0};
    if(e.action==="in"){ c.ikg+=(e.kg||0); c.ipcs+=(e.pcs||0); }
    else{ c.okg+=(e.kg||0); c.opcs+=(e.pcs||0); }
  });
  const ids=Object.keys(items);
  const opening=openingMap(fid, dayStart, ids);
  const label=dateStr(new Date(dayStart));

  const rows=[HEADER];
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

/* Хуудасны нэр 31 тэмдэгтээс ихгүй, "/\?*[]" тэмдэгт агуулж болохгүй байх ёстой */
function safeSheetName(name){
  return String(name||"Хөргүүр").replace(/[\\/?*\[\]:]/g,"·").slice(0,31) || "Хөргүүр";
}

export function exportDayXlsx(){
  const F=window.XLSX;
  if(!F){ toast("Excel сан ачаалагдсангүй · интернэт холболтоо шалгаад дахин оролдоно уу"); return; }

  const el=document.getElementById("dashXlsxDate");
  const dIso = (el && el.value) || isoStr();

  const wb=F.utils.book_new();
  const used={};
  let any=false;
  (db.fridges||[]).forEach(fr=>{
    const rows=fridgeRows(fr.id, dIso);
    if(rows.length>1) any=true;
    const ws=F.utils.aoa_to_sheet(rows);
    ws['!cols']=[{wch:12},{wch:24},{wch:8},{wch:14},{wch:12},{wch:12},{wch:14}];
    let name=safeSheetName(fr.name);
    if(used[name]){ used[name]++; name=(name+" "+used[name]).slice(0,31); } else used[name]=1;
    F.utils.book_append_sheet(wb, ws, name);
  });

  if(!any){ toast("Энэ өдөр ямар ч хөргүүрт хөдөлгөөн бүртгэгдээгүй байна"); return; }

  F.writeFile(wb, `hurguur_${dIso}.xlsx`);
  toast("Excel файл татагдлаа");
}
