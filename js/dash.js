import { db, state } from './state.js';
import { esc, num, isoStr, isoMonth, timeStr, dateStr, dayKey, dayKeyOfIso,
         monthKey, monthKeyOfIso, qtyLine, itemName, money, liveItems, workerName,
         lQty, lUnit, uShort, stock, fridgeName, mainUnitOf } from './util.js';
import { $, toast } from './ui.js';
import { show, registerScreen } from './router.js';
import { requireOnline } from './auth.js';

const DASH = () => state.dash;

export function openDash(){
  if(!state.isAdmin){ toast("Энэ хэсэг зөвхөн админд нээлттэй"); return; }
  if(!requireOnline()) return;
  DASH().openOrg=null;
  DASH().date = DASH().date || isoStr();
  const el=$("dashDate"); el.value=DASH().date; el.max=isoStr();
  const xd=$("dashXlsxDate"); if(xd){ xd.value=DASH().date; xd.max=isoStr(); }
  renderDash(); show("scrDash");
}
export function setDashDate(v){ DASH().date = v || isoStr(); renderDash(); }
export function toggleDashOrg(k){ DASH().openOrg = DASH().openOrg===k ? null : k; renderDash(); }

function stockMapAt(ts,fids){
  const map={};
  db.log.forEach(e=>{
    if(e.ts>ts) return;
    if(fids && fids.indexOf(e.fridge)<0) return;
    const c = map[e.item] = map[e.item] || {kg:0,pcs:0};
    const s=e.action==="in"?1:-1;
    c.kg+=s*(e.kg||0); c.pcs+=s*(e.pcs||0);
  });
  return map;
}
function qtyFromMap(map,itemId){
  const c=map[itemId];
  if(!c) return 0;
  return mainUnitOf(itemId)==="pcs" ? c.pcs : num(c.kg);
}

const IH = () => state.itemHist;

export function openItemHist(itemId){
  IH().item=itemId;
  const d=DASH().date||isoStr();
  IH().from = IH().from || d;
  IH().to   = IH().to   || d;
  $("ihFrom").value=IH().from; $("ihFrom").max=isoStr();
  $("ihTo").value=IH().to;     $("ihTo").max=isoStr();
  renderItemHist(); show("scrItemHist");
}
export function setItemHistFrom(v){
  IH().from = v || isoStr();
  if(IH().to < IH().from){ IH().to=IH().from; $("ihTo").value=IH().to; }
  renderItemHist();
}
export function setItemHistTo(v){
  IH().to = v || isoStr();
  if(IH().to < IH().from){ IH().from=IH().to; $("ihFrom").value=IH().from; }
  renderItemHist();
}
function dayStartTs(iso){ return new Date(iso+"T00:00:00").getTime(); }
function dayEndTs(iso){ return new Date(iso+"T23:59:59.999").getTime(); }

export function renderItemHist(){
  const id=IH().item;
  if(!id){ show("scrDash"); return; }
  $("ihTitle").textContent=itemName(id);
  const u=uShort(mainUnitOf(id));
  const from=dayStartTs(IH().from), to=dayEndTs(IH().to);

  const opening=qtyFromMap(stockMapAt(from-1),id);

  const rows=db.log.filter(e=>e.item===id && e.ts>=from && e.ts<=to).sort((a,b)=>a.ts-b.ts);
  const label = IH().from===IH().to
    ? dateStr(new Date(from))
    : dateStr(new Date(from))+" — "+dateStr(new Date(to));

  if(!rows.length){
    $("ihBody").innerHTML=`<div class="card"><h3>${label}</h3>
      <div class="item-row"><span class="item-name">Эхний үлдэгдэл</span>
        <span class="item-val">${num(opening)} ${u}</span></div>
      <div class="empty">Энэ хугацаанд хөдөлгөөн байхгүй</div></div>`;
    return;
  }
  let run=num(opening), tin=0, tout=0;
  const body=rows.map(e=>{
    const q = mainUnitOf(id)==="pcs" ? (e.pcs||0) : num(e.kg||0);
    const isIn = e.action==="in";
    run = num(run + (isIn?q:-q));
    if(isIn) tin+=q; else tout+=q;
    const src = isIn ? (e.purchase?"Гаднаас авсан":("Оруулсан"+(e.by?" · "+workerName(e.by):"")))
                     : (e.receipt?"Гаргасан · баримттай":"Гаргасан");
    return `<tr>
      <td class="dim">${dateStr(new Date(e.ts))}<div class="dim">${timeStr(new Date(e.ts))}</div></td>
      <td class="nm">${esc(fridgeName(e.fridge))}<div class="dim">${esc(src)}</div></td>
      <td class="num" style="color:${isIn?"var(--moss)":"var(--rust)"}">${isIn?"+":"−"}${q}</td>
      <td class="amt">${run}</td></tr>`;
  }).join("");

  $("ihBody").innerHTML=`<div class="card"><h3>${label}</h3>
    <div class="item-row"><span class="item-name">Эхний үлдэгдэл</span>
      <span class="item-val">${num(opening)} ${u}</span></div>
    <div class="item-row"><span class="item-name">Орсон</span>
      <span class="item-val mv-in">+${num(tin)} ${u}</span></div>
    <div class="item-row"><span class="item-name">Гарсан</span>
      <span class="item-val mv-out">−${num(tout)} ${u}</span></div>
    <div class="total-line"><span>Эцсийн үлдэгдэл</span><b>${run} ${u}</b></div>
  </div>
  <div class="card"><h3>Хөдөлгөөн бүрээр</h3>
    <div class="tbl-wrap"><table class="tbl" style="min-width:360px">
      <thead><tr><th>Огноо</th><th>Хаана</th><th class="num">Хэмжээ</th><th class="num">Үлдэгдэл</th></tr></thead>
      <tbody>${body}</tbody></table></div></div>`;
}
registerScreen("scrItemHist", renderItemHist);

export function renderDash(){
  const dk=dayKeyOfIso(DASH().date||isoStr());

  const dayEnd=new Date(DASH().date+"T23:59:59").getTime();
  const dayStart=new Date(DASH().date+"T00:00:00").getTime();
  const beforeMap=stockMapAt(dayStart), afterMap=stockMapAt(dayEnd);
  const rows=liveItems().map(it=>({
    it,
    before:qtyFromMap(beforeMap,it.id),
    after: qtyFromMap(afterMap, it.id)
  })).filter(r=>r.before||r.after);

  $("dashStock").innerHTML = rows.length ? `<div class="tbl-wrap"><table class="tbl" style="min-width:330px">
      <thead><tr><th>Бараа</th><th class="num">Өмнөх</th><th class="num">Өөрчлөлт</th><th class="num">Үлдэгдэл</th></tr></thead>
      <tbody>${rows.map(r=>{
        const d=num(r.after-r.before);
        const col=d>0?"var(--moss)":(d<0?"var(--rust)":"var(--muted)");
        return `<tr style="cursor:pointer" onclick="openItemHist('${r.it.id}')">
          <td class="nm">${esc(r.it.name)} <span class="dim">›</span></td>
          <td class="num dim">${r.before}</td>
          <td class="num" style="color:${col}">${d>0?"+":""}${d||"—"}</td>
          <td class="amt">${r.after} ${uShort(mainUnitOf(r.it.id))}</td></tr>`;
      }).join("")}</tbody></table></div>`
    : `<div class="empty">Хөргүүрүүд хоосон байна</div>`;

  const inn={};
  db.log.forEach(e=>{
    if(e.action!=="in" || dayKey(e.ts)!==dk) return;
    if(!inn[e.item]) inn[e.item]={wkg:0,wpcs:0,bkg:0,bpcs:0};
    const t=inn[e.item];
    if(e.purchase){ t.bkg+=(e.kg||0); t.bpcs+=(e.pcs||0); }
    else{ t.wkg+=(e.kg||0); t.wpcs+=(e.pcs||0); }
  });
  const inKeys=Object.keys(inn);
  $("dashIn").innerHTML = inKeys.length ? inKeys.map(k=>{
    const t=inn[k], sub=[];
    if(t.wkg||t.wpcs) sub.push("Үйлдвэрээс "+qtyLine(t.wkg,t.wpcs,k));
    if(t.bkg||t.bpcs) sub.push("Гаднаас "+qtyLine(t.bkg,t.bpcs,k));
    return `<div class="item-row"><span class="item-name">${esc(itemName(k))}
      <small>${esc(sub.join(" · "))}</small></span>
      <span class="item-val mv-in">+${qtyLine(t.wkg+t.bkg,t.wpcs+t.bpcs,k)}</span></div>`;
  }).join("") : `<div class="empty">Энэ өдөр бараа ороогүй байна</div>`;

  const out={};
  db.log.forEach(e=>{
    if(e.action!=="out" || dayKey(e.ts)!==dk) return;
    if(!out[e.item]) out[e.item]={kg:0,pcs:0};
    out[e.item].kg+=(e.kg||0); out[e.item].pcs+=(e.pcs||0);
  });
  const outKeys=Object.keys(out);
  $("dashOut").innerHTML = outKeys.length ? outKeys.map(k=>`
    <div class="item-row"><span class="item-name">${esc(itemName(k))}</span>
      <span class="item-val mv-out">−${qtyLine(out[k].kg,out[k].pcs,k)}</span></div>`).join("")
    : `<div class="empty">Энэ өдөр бараа гараагүй байна</div>`;

  const rcs=db.receipts.filter(r=>dayKey(r.ts)===dk).sort((a,b)=>b.ts-a.ts);
  const gr={};
  rcs.forEach(r=>{
    const k=r.buyer.pid || ("name:"+r.buyer.name);
    if(!gr[k]) gr[k]={name:r.buyer.name,rows:[],total:0,items:{}};
    gr[k].rows.push(r); gr[k].total+=r.total;
    r.lines.forEach(l=>{
      const c=gr[k].items[l.item] = gr[k].items[l.item] || {kg:0,pcs:0};
      if(lUnit(l)==="pcs") c.pcs+=lQty(l);
      else{ c.kg+=lQty(l); c.pcs+=(l.pcs||0); }
    });
  });
  const gk=Object.keys(gr).sort((a,b)=>gr[b].total-gr[a].total);
  const sold=gk.reduce((s,k)=>s+gr[k].total,0);
  $("dashDest").innerHTML = (gk.length ? gk.map(k=>{
    const g=gr[k], open=DASH().openOrg===k;
    const sum=Object.keys(g.items).map(i=>itemName(i)+" "+qtyLine(g.items[i].kg,g.items[i].pcs,i)).join(", ");
    let h=`<button type="button" class="exp-head" onclick="toggleDashOrg('${esc(k)}')">
      <span class="exp-arrow">${open?"▾":"▸"}</span>
      <span class="exp-main">${esc(g.name)}<small>${g.rows.length} удаа · ${esc(sum)}</small></span>
      <span class="exp-val">${money(g.total)}</span></button>`;
    if(open){
      h+=`<div class="exp-body">${g.rows.map(r=>`
        <div class="item-row" style="cursor:pointer" onclick="openOneReceipt('${r.id}')">
          <span class="item-name">БАР-${r.no}
            <small>${timeStr(new Date(r.ts))} · ${esc(r.lines.map(l=>l.name+" "+lQty(l)+uShort(lUnit(l))).join(", "))}</small></span>
          <span class="item-val">${money(r.total)}</span></div>`).join("")}</div>`;
    }
    return h;
  }).join("") : `<div class="empty">Энэ өдөр баримт гараагүй байна</div>`)
  + (gk.length?`<div class="total-line"><span>Борлуулалт</span><b>${money(sold)}</b></div>`:"");

}
registerScreen("scrDash", renderDash);
