/* Цалин.
   Цалин руу орох мөчид сарын хүснэгт шууд гарна: мөр нь ажилчин, багана нь өдөр.
   Нэр дээр дарвал тухайн ажилчны дэлгэрэнгүй нээгдэнэ.
   Зөвхөн урьдчилгаа бүртгэгддэг — улаанаар тодорно. */
import { db, state, uid, saveLocal } from './state.js';
import { esc, f, num, money, dayKey, monthKey, monthKeyOfIso,
         isoStr, isoMonth, tsOfIso, dateStr, itemName,
         payUnitOf, uShort, rateOf, qtyFor, payFor, liveWorkers, workerName } from './util.js';
import { $, toast } from './ui.js';
import { show, registerScreen } from './router.js';
import { fbSet, fbDel, save } from './sync.js';
import { requireOnline } from './auth.js';

const S = () => state.salary;

/* Бүрэн админ эсвэл Цалингийн тусгай кодоор орсон хүн — хоёулаа
   ажлын бүртгэл нэмэх, урьдчилгаа, ирц удирдах эрхтэй. Гэхдээ энэ
   эрх зөвхөн Цалин хэсэгт хамаарах бөгөөд Тохиргоо, Худалдан авах
   зэрэг бусад хэсэгт хандах эрх өгөхгүй. */
function canManageSalary(){ return state.isAdmin || state.salaryUnlocked; }

/* ===================== Нийтлэг тооцоо ===================== */
function monthOf(){ return S().month || isoMonth(); }
function inMonth(ts){ return monthKey(ts)===monthKeyOfIso(monthOf()); }
function monthLabel(){
  const a=monthOf().split("-");
  return a[0]+" оны "+(+a[1])+"-р сар";
}
function dayNo(ts){ return new Date(ts).getDate(); }
function colLabel(d){ return (+monthOf().split("-")[1])+"/"+d; }

function worksOf(wid){
  return (db.works||[]).filter(x=>x.worker===wid && inMonth(x.ts) && qtyFor(x)>0);
}
/* Тогтмол цалинтай ажилчны ирц */
function attendOf(wid){
  return (db.attend||[]).filter(x=>x.worker===wid && inMonth(x.ts)).sort((a,b)=>a.ts-b.ts);
}
function advancesOf(wid){
  return (db.wagepays||[]).filter(x=>x.worker===wid && inMonth(x.ts)).sort((a,b)=>a.ts-b.ts);
}
function advanceSum(wid){ return advancesOf(wid).reduce((s,x)=>s+x.amount,0); }

/* Ажилчны сарын олсон дүн ба өдөр тутмын задаргаа */
function earnByDay(w){
  const byDay={};
  if(w.payType==="fixed"){
    /* Тогтмол цалинтай — тэмдэглэсэн ирцийн өдөр тутамд өдрийн хөлс.
       Хэсгийн ажил бүртгүүлсэн бол тэр өдөр нь ч ажилласанд тооцогдоно. */
    const rate=+w.salary||0;
    attendOf(w.id).forEach(x=>{ byDay[dayNo(x.ts)]=rate; });
    worksOf(w.id).forEach(x=>{ byDay[dayNo(x.ts)]=rate; });
  }else{
    worksOf(w.id).forEach(x=>{
      const d=dayNo(x.ts);
      byDay[d]=(byDay[d]||0)+payFor(x);
    });
  }
  let total=0;
  Object.keys(byDay).forEach(d=>{ total+=byDay[d]; });
  return {byDay,total,days:Object.keys(byDay).length};
}

/* ===================== Үндсэн дэлгэц ===================== */
export function openSalary(){
  if(!requireOnline()) return;
  S().month = S().month || isoMonth();
  $("salMonth").value=S().month;
  renderSalary(); show("scrSalary");
}
export function setSalMonth(v){ S().month = v || isoMonth(); renderSalary(); }

/* Энгийн ажилчнаар орсон хүн Цалин хэсэгт "Цалин бодох" товчоор
   тусгай (админаас өөр) 4 оронтой кодоо оруулж, ажилчин нэмэх,
   ажлын бүртгэл нэмэх, урьдчилгаа нэмэх, ирц тэмдэглэх зэрэг
   Цалин хэсгийн эрхийг нээж болно. Энэ нь бүрэн админ болгохгүй —
   Тохиргоо, Худалдан авах зэрэг бусад хэсэг хаалттай хэвээр үлдэнэ. */
export function unlockSalaryAdmin(){
  if(canManageSalary()){ renderSalary(); return; }
  if(!requireOnline()) return;
  const v=prompt("Цалин бодох — тусгай 4 оронтой кодоо оруулна уу");
  if(v===null) return;
  if(!/^\d{4}$/.test(v.trim()) || v.trim()!==db.salaryPin){
    toast("Код буруу байна");
    return;
  }
  state.salaryUnlocked=true;
  toast("Цалингийн эрх нээгдлээ");
  renderSalary();
}

export function renderSalary(){
  $("salTitle").textContent=monthLabel();
  const uc=$("salUnlockCard"), ac=$("salAddCard");
  if(uc) uc.style.display = canManageSalary() ? "none" : "block";
  if(ac) ac.style.display = canManageSalary() ? "block" : "none";
  const ws=liveWorkers();
  if(!ws.length){ $("salBody").innerHTML=`<div class="empty">Ажилчин бүртгээгүй байна</div>`; return; }

  /* Өгөгдөлтэй өдрүүд л багана болно */
  const dset={};
  (db.works||[]).forEach(x=>{ if(inMonth(x.ts) && qtyFor(x)>0) dset[dayNo(x.ts)]=1; });
  (db.attend||[]).forEach(x=>{ if(inMonth(x.ts)) dset[dayNo(x.ts)]=1; });
  const days=Object.keys(dset).map(Number).sort((a,b)=>a-b);

  const rows=ws.map(w=>({w, e:earnByDay(w), adv:advanceSum(w.id)}))
               .filter(r=>r.e.total>0 || r.adv>0);
  if(!rows.length){
    $("salBody").innerHTML=`<div class="empty">${monthLabel()}-д ажлын бүртгэл алга.<br>
      Доорх товчоор ажлын бүртгэл нэмнэ үү.</div>`;
    return;
  }

  const colTotal={};
  let gEarn=0, gAdv=0;
  const body=rows.map(r=>{
    const tds=days.map(d=>{
      const v=r.e.byDay[d]||0;
      colTotal[d]=(colTotal[d]||0)+v;
      return `<td class="num${v?"":" dim"}">${v?money(v):"—"}</td>`;
    }).join("");
    gEarn+=r.e.total; gAdv+=r.adv;
    return `<tr style="cursor:pointer" onclick="openWorkerDetail('${r.w.id}')">
      <td class="nm">${esc(r.w.name)} <span class="dim">›</span>
        ${r.adv?`<div style="color:var(--rust);font-weight:700">урьдчилгаа −${money(r.adv)}</div>`:""}</td>
      ${tds}
      <td class="amt">${money(r.e.total)}</td>
      <td class="amt" style="color:${r.adv?"var(--rust)":"var(--blue-ink)"}">${money(r.e.total-r.adv)}</td></tr>`;
  }).join("");

  const sumRow=`<tr class="sum"><td>Нийт</td>
    ${days.map(d=>`<td class="num">${money(colTotal[d]||0)}</td>`).join("")}
    <td class="amt">${money(gEarn)}</td>
    <td class="amt" style="color:${gAdv?"var(--rust)":"var(--blue-ink)"}">${money(gEarn-gAdv)}</td></tr>`;

  $("salBody").innerHTML=`<div class="tbl-wrap"><table class="tbl" style="min-width:${260+days.length*88}px">
      <thead><tr><th>Нэр</th>${days.map(d=>`<th class="num">${colLabel(d)}</th>`).join("")}
        <th class="num">Нийт</th><th class="num">Олгох</th></tr></thead>
      <tbody>${body}${sumRow}</tbody></table></div>
    ${gAdv?`<div class="tbl-note">Улаанаар тодорсон дүн бол авсан урьдчилгаа.</div>`:""}`;
}

/* ===================== Ажилчны дэлгэрэнгүй ===================== */
export function openWorkerDetail(wid){
  S().open=wid;
  renderWorkerDetail(); show("scrWorker");
}
export function renderWorkerDetail(){
  const w=db.workers.find(x=>x.id===S().open);
  if(!w){ show("scrSalary"); return; }
  $("wdTitle").textContent=w.name;
  $("wdMonth").value=monthOf();

  const e=earnByDay(w), adv=advanceSum(w.id), list=advancesOf(w.id);
  const days=Object.keys(e.byDay).map(Number).sort((a,b)=>a-b);

  /* 1. Ангилал × өдөр */
  let itemBlock;
  if(!days.length){
    itemBlock=`<div class="card"><div class="empty">${monthLabel()}-д ажлын бүртгэл алга</div></div>`;
  }else if(w.payType==="fixed"){
    const att={};
    attendOf(w.id).forEach(x=>{ att[dayNo(x.ts)]=x.id; });
    itemBlock=`<div class="card"><h3>Ажилласан өдрүүд</h3>
      <div class="tbl-wrap"><table class="tbl" style="min-width:0">
        <thead><tr><th>Огноо</th><th class="num">Өдрийн хөлс</th><th></th></tr></thead>
        <tbody>${days.map(d=>`<tr><td class="nm">${colLabel(d)}</td>
          <td class="amt">${money(e.byDay[d])}</td>
          <td>${canManageSalary()&&att[d]?`<button class="icon-btn" style="padding:4px 8px;font-size:12px"
                 onclick="delAttend('${att[d]}')">✕</button>`:""}</td></tr>`).join("")}
          <tr class="sum"><td>${days.length} өдөр · нийт</td><td class="amt">${money(e.total)}</td><td></td></tr>
        </tbody></table></div>
      ${canManageSalary()?`<button class="btn btn-sm" style="margin-top:12px"
          onclick="openAttend()">Ирц тэмдэглэх</button>`:""}</div>`;
  }else{
    const items={};
    worksOf(w.id).forEach(x=>{
      const r=items[x.item]=items[x.item]||{};
      r[dayNo(x.ts)]=(r[dayNo(x.ts)]||0)+qtyFor(x);
    });
    const ids=Object.keys(items);
    itemBlock=`<div class="card"><h3>Ямар ангилал дээр хэдийг хийсэн</h3>
      <div class="tbl-wrap"><table class="tbl" style="min-width:${200+days.length*82}px">
        <thead><tr><th>Ангилал</th>${days.map(d=>`<th class="num">${colLabel(d)}</th>`).join("")}
          <th class="num">Нийт</th><th class="num">Дүн</th></tr></thead>
        <tbody>${ids.map(id=>{
          const u=uShort(payUnitOf(id)); let tot=0;
          const tds=days.map(d=>{
            const v=items[id][d]||0; tot+=v;
            return `<td class="num${v?"":" dim"}">${v?num(v)+" "+u:"—"}</td>`;
          }).join("");
          return `<tr><td class="nm">${esc(itemName(id))}<div class="dim">${money(rateOf(w.id,id))}/${u}</div></td>
            ${tds}<td class="num">${num(tot)} ${u}</td>
            <td class="amt">${money(tot*rateOf(w.id,id))}</td></tr>`;
        }).join("")}
          <tr class="sum"><td colspan="${days.length+2}">${monthLabel()} · олсон</td>
            <td class="amt">${money(e.total)}</td></tr>
        </tbody></table></div></div>`;
  }

  /* 2. Урьдчилгаа */
  const advBlock=`<div class="card"><h3>Урьдчилгаа</h3>
    ${list.length ? `<div class="tbl-wrap"><table class="tbl" style="min-width:0">
      <thead><tr><th>Огноо</th><th>Тайлбар</th><th class="num">Дүн</th><th></th></tr></thead>
      <tbody>${list.map(x=>`<tr>
        <td class="nm">${dateStr(new Date(x.ts))}</td>
        <td class="dim">${esc(x.note||"—")}</td>
        <td class="amt" style="color:var(--rust)">−${money(x.amount)}</td>
        <td>${canManageSalary()?`<button class="icon-btn" style="padding:4px 8px;font-size:12px"
               onclick="delAdvance('${x.id}')">✕</button>`:""}</td></tr>`).join("")}
      </tbody></table></div>`
    : `<div class="empty">Урьдчилгаа аваагүй байна</div>`}
    ${canManageSalary()?`<button class="btn btn-sm" style="margin-top:12px"
        onclick="addAdvance('${w.id}')">Урьдчилгаа нэмэх</button>`:""}</div>`;

  /* 3. Дүн */
  const totalBlock=`<div class="card">
    <div class="item-row"><span class="item-name">Олсон цалин</span>
      <span class="item-val">${money(e.total)}</span></div>
    <div class="item-row"><span class="item-name">Урьдчилгаа</span>
      <span class="item-val" style="color:var(--rust)">${adv?"−"+money(adv):"—"}</span></div>
    <div class="total-line"><span>Олгох дүн</span><b>${money(e.total-adv)}</b></div></div>`;

  $("wdBody").innerHTML = totalBlock + itemBlock + advBlock;
}

/* ===================== Ажилчин нэмэх (Цалин хэсгээс шууд) ===================== */
export function addWorkerInline(){
  if(!requireOnline()) return;
  const el=$("salNewWorkerName");
  const n=(el.value||"").trim();
  if(!n){ toast("Ажилчны нэрийг бичнэ үү"); return; }
  const rates={}; db.items.forEach(i=>{ rates[i.id]=+i.defRate||0; });
  db.workers.push({id:uid(), name:n, rates, payType:"piece", salary:0});
  el.value="";
  save();
  renderSalary();
  toast(n+" нэмэгдлээ");
}

/* ===================== Урьдчилгаа ===================== */
export function addAdvance(wid){
  if(!requireOnline()) return;
  const v=prompt(`${workerName(wid)} — урьдчилгаа хэдэн төгрөг вэ?`,"");
  if(v===null) return;
  const amount=f(v);
  if(amount<=0){ toast("Дүнгээ оруулна уу"); return; }
  const d=prompt("Огноо (ЖЖЖЖ-СС-ӨӨ)", isoStr());
  if(d===null) return;
  const iso=/^\d{4}-\d{2}-\d{2}$/.test(d.trim()) ? d.trim() : isoStr();
  const note=(prompt("Тайлбар (заавал биш)","")||"").trim();
  const rec={id:uid(), ts:tsOfIso(iso), worker:wid, kind:"advance", amount:num(amount), note};
  db.wagepays.push(rec);
  saveLocal(); fbSet("wagepays",rec.id,rec);
  renderWorkerDetail();
  toast(`${dateStr(new Date(rec.ts))} · ${money(amount)} урьдчилгаа`);
}
export function delAdvance(id){
  if(!requireOnline()) return;
  if(!confirm("Энэ урьдчилгааг устгах уу?")) return;
  db.wagepays=db.wagepays.filter(x=>x.id!==id);
  saveLocal(); fbDel("wagepays",id);
  renderWorkerDetail(); toast("Устгалаа");
}

/* Ирцийн тэмдэглэгээ устгах */
export function delAttend(id){
  if(!requireOnline()) return;
  if(!confirm("Энэ өдрийн ирцийг устгах уу?")) return;
  db.attend=db.attend.filter(x=>x.id!==id);
  saveLocal(); fbDel("attend",id);
  renderWorkerDetail(); toast("Устгалаа");
}

/* Ажлын бүртгэлийг устгах — work.js-ээс дуудагдана */
export function delWork(id){
  if(!requireOnline()) return;
  if(!confirm("Энэ ажлын бүртгэлийг устгах уу?")) return;
  db.works=db.works.filter(x=>x.id!==id);
  saveLocal(); fbDel("works",id);
  renderWorkerDetail();
  toast("Устгалаа");
}

registerScreen("scrSalary", renderSalary);
registerScreen("scrWorker", renderWorkerDetail);
