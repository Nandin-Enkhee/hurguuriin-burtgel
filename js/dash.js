/* Хяналтын самбар — өдрийн зураглал */
import { db, state } from './state.js';
import { esc, num, isoStr, isoMonth, timeStr, dateStr, dayKey, dayKeyOfIso,
         monthKey, monthKeyOfIso, qtyLine, itemName, money, liveItems, workerName,
         payFor, lQty, lUnit, uShort, stock, fridgeName, mainUnitOf } from './util.js';
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
  renderDash(); show("scrDash");
}
export function setDashDate(v){ DASH().date = v || isoStr(); renderDash(); }
export function toggleDashOrg(k){ DASH().openOrg = DASH().openOrg===k ? null : k; renderDash(); }

/* Тухайн мөч хүртэлх үлдэгдэл (гол нэгжээр) */
function stockAt(fid,itemId,ts){
  let kg=0,pcs=0;
  db.log.forEach(e=>{
    if(e.fridge!==fid || e.item!==itemId || e.ts>ts) return;
    const s=e.action==="in"?1:-1;
    kg+=s*(e.kg||0); pcs+=s*(e.pcs||0);
  });
  return mainUnitOf(itemId)==="pcs" ? pcs : num(kg);
}

/* ---------- Барааны түүх ---------- */
const IH = () => state.itemHist;
export function openItemHist(itemId){
  IH().item=itemId;
  IH().month = IH().month || isoMonth();
  $("ihMonth").value=IH().month;
  renderItemHist(); show("scrItemHist");
}
export function setItemHistMonth(v){ IH().month = v || isoMonth(); renderItemHist(); }
export function renderItemHist(){
  const id=IH().item;
  if(!id){ show("scrDash"); return; }
  $("ihTitle").textContent=itemName(id);
  const mk=monthKeyOfIso(IH().month||isoMonth());
  const a=(IH().month||isoMonth()).split("-");
  const monthStart=new Date(+a[0],+a[1]-1,1).getTime();

  let opening=0;
  db.fridges.forEach(fr=>{ opening+=stockAt(fr.id,id,monthStart-1); });

  const rows=db.log.filter(e=>e.item===id && monthKey(e.ts)===mk).sort((a,b)=>a.ts-b.ts);
  if(!rows.length){
    $("ihBody").innerHTML=`<div class="card"><div class="empty">Энэ сард хөдөлгөөн байхгүй.<br>
      Сарын эхний үлдэгдэл: <b>${num(opening)} ${uShort(mainUnitOf(id))}</b></div></div>`;
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

  $("ihBody").innerHTML=`<div class="card">
    <h3>${a[0]} оны ${+a[1]}-р сар</h3>
    <div class="item-row"><span class="item-name">Сарын эхэнд</span>
      <span class="item-val">${num(opening)} ${uShort(mainUnitOf(id))}</span></div>
    <div class="item-row"><span class="item-name">Орсон</span>
      <span class="item-val mv-in">+${num(tin)}</span></div>
    <div class="item-row"><span class="item-name">Гарсан</span>
      <span class="item-val mv-out">−${num(tout)}</span></div>
    <div class="total-line"><span>Сарын эцэст</span><b>${run} ${uShort(mainUnitOf(id))}</b></div>
  </div>
  <div class="card"><h3>Хөдөлгөөн бүрээр</h3>
    <div class="tbl-wrap"><table class="tbl" style="min-width:360px">
      <thead><tr><th>Огноо</th><th>Хаана</th><th class="num">Хэмжээ</th><th class="num">Үлдэгдэл</th></tr></thead>
      <tbody>${body}</tbody></table></div></div>`;
}
registerScreen("scrItemHist", renderItemHist);

export function renderDash(){
  const dk=dayKeyOfIso(DASH().date||isoStr());

  /* Сонгосон өдрийн эцсийн үлдэгдэл ба тэр өдрийн өмнөх үлдэгдэл.
     Барааны нэр дээр дарвал тухайн барааны түүх нээгдэнэ. */
  const dayEnd=new Date(DASH().date+"T23:59:59").getTime();
  const dayStart=new Date(DASH().date+"T00:00:00").getTime();
  const rows=liveItems().map(it=>{
    let before=0, after=0;
    db.fridges.forEach(fr=>{
      if((it.fridges||[1,2]).indexOf(fr.id)<0) return;
      before+=stockAt(fr.id,it.id,dayStart);
      after +=stockAt(fr.id,it.id,dayEnd);
    });
    return {it, before:num(before), after:num(after)};
  }).filter(r=>r.before||r.after);

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

  /* Тухайн өдөр орсон */
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

  /* Тухайн өдөр гарсан */
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

  /* Хаашаа гарсан — нэг байгууллага нэг мөр, дарвал задарна */
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

  /* Ажилчдын цалин */
  const pay={};
  (db.works||[]).forEach(x=>{
    if(dayKey(x.ts)!==dk) return;
    pay[x.worker]=(pay[x.worker]||0)+payFor(x);
  });
  const pk=Object.keys(pay);
  const ptot=pk.reduce((s,k)=>s+pay[k],0);
  $("dashPay").innerHTML = (pk.length ? pk.map(k=>`
    <div class="item-row"><span class="item-name">${esc(workerName(k))}</span>
      <span class="item-val">${money(pay[k])}</span></div>`).join("")
    : `<div class="empty">Энэ өдөр цалин бодогдоогүй байна</div>`)
  + (pk.length?`<div class="total-line"><span>Нийт</span><b>${money(ptot)}</b></div>`:"");
}
registerScreen("scrDash", renderDash);
