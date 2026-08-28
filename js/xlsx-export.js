/* Сарын хөдөлгөөнийг Excel рүү экспортлох.
   Хяналтын самбараас сар сонгоод дарахад бүх хөргүүрийн орсон, гарсан
   хэмжээг хөргүүр тус бүрд нь тусдаа хуудас болгож нэг Excel файлаар татна.
   Тооцоо нь Тохиргоо → Баримт, түүх (records.js) дээрхтэй ижил логик:
   өдөр, бараа тус бүрээр эхний үлдэгдэл → орсон → гарсан → эцсийн үлдэгдэл. */
import { db } from './state.js';
import { dateStr, dayKey, monthKey, monthKeyOfIso, itemName,
         mainUnitOf, uShort, num, isoMonth } from './util.js';
import { toast } from './ui.js';

/* Сарын эхлэхээс өмнөх үлдэгдлийг барааны жагсаалтаар нэг удаа бодно */
function openingMap(fid, firstTs, ids){
  const map={};
  ids.forEach(id=>{ map[id]={kg:0,pcs:0}; });
  db.log.forEach(e=>{
    if(e.fridge!==fid || e.ts>=firstTs) return;
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

/* Нэг хөргүүрийн тухайн сарын мөрүүд — Excel хуудсанд шууд бичигдэнэ */
function fridgeRows(fid, mk){
  const logRows=db.log.filter(e=>e.fridge===fid && monthKey(e.ts)===mk);
  if(!logRows.length) return [HEADER];

  const days={};
  logRows.forEach(e=>{
    const dk=dayKey(e.ts);
    const d = days[dk] = days[dk] || {ts:e.ts, items:{}};
    if(e.ts<d.ts) d.ts=e.ts;
    const c = d.items[e.item] = d.items[e.item] || {ikg:0,ipcs:0,okg:0,opcs:0};
    if(e.action==="in"){ c.ikg+=(e.kg||0); c.ipcs+=(e.pcs||0); }
    else{ c.okg+=(e.kg||0); c.opcs+=(e.pcs||0); }
    d.logs=1;
  });
  const dks=Object.keys(days).sort((a,b)=>days[a].ts-days[b].ts);

  const first=days[dks[0]].ts;
  const fd=new Date(first);
  const monthStart=new Date(fd.getFullYear(),fd.getMonth(),1).getTime();
  const touched={};
  dks.forEach(dk=>Object.keys(days[dk].items).forEach(id=>{ touched[id]=1; }));
  const running=openingMap(fid, monthStart, Object.keys(touched));

  const rows=[HEADER];
  dks.forEach(dk=>{
    const d=days[dk];
    Object.keys(d.items).forEach(id=>{
      const c=d.items[id];
      const open=running[id]||{kg:0,pcs:0};
      const close={kg:num(open.kg+c.ikg-c.okg), pcs:open.pcs+c.ipcs-c.opcs};
      running[id]=close;
      rows.push([
        dateStr(new Date(d.ts)),
        itemName(id),
        uShort(mainUnitOf(id)),
        qtyOfUnit(open.kg,open.pcs,id),
        qtyOfUnit(c.ikg,c.ipcs,id),
        qtyOfUnit(c.okg,c.opcs,id),
        qtyOfUnit(close.kg,close.pcs,id)
      ]);
    });
  });
  return rows;
}

/* Хуудасны нэр 31 тэмдэгтээс ихгүй, "/\?*[]" тэмдэгт агуулж болохгүй байх ёстой */
function safeSheetName(name){
  return String(name||"Хөргүүр").replace(/[\\/?*\[\]:]/g,"·").slice(0,31) || "Хөргүүр";
}

export function exportMonthXlsx(){
  const F=window.XLSX;
  if(!F){ toast("Excel сан ачаалагдсангүй · интернэт холболтоо шалгаад дахин оролдоно уу"); return; }

  const el=document.getElementById("dashXlsxMonth");
  const mIso = (el && el.value) || isoMonth();
  const mk=monthKeyOfIso(mIso);

  const wb=F.utils.book_new();
  const used={};
  let any=false;
  (db.fridges||[]).forEach(fr=>{
    const rows=fridgeRows(fr.id, mk);
    if(rows.length>1) any=true;
    const ws=F.utils.aoa_to_sheet(rows);
    ws['!cols']=[{wch:12},{wch:24},{wch:8},{wch:14},{wch:12},{wch:12},{wch:14}];
    let name=safeSheetName(fr.name);
    if(used[name]){ used[name]++; name=(name+" "+used[name]).slice(0,31); } else used[name]=1;
    F.utils.book_append_sheet(wb, ws, name);
  });

  if(!any){ toast("Энэ сард ямар ч хөргүүрт хөдөлгөөн бүртгэгдээгүй байна"); return; }

  const a=mIso.split("-");
  F.writeFile(wb, `hurguur_${a[0]}-${a[1]}.xlsx`);
  toast("Excel файл татагдлаа");
}
