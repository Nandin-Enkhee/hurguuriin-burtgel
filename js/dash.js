/* Хяналтын самбар — өдрийн зураглал */
import { db, state } from './state.js';
import { esc, isoStr, timeStr, dayKey, dayKeyOfIso, qtyLine, itemName, money,
         liveItems, workerName, payFor, lQty, lUnit, uShort, stock, fridgeName } from './util.js';
import { $, toast } from './ui.js';
import { show, registerScreen } from './router.js';

const D = () => state.dash;

export function openDash(){
  if(!state.isAdmin){ toast("Энэ хэсэг зөвхөн админд нээлттэй"); return; }
  D().openOrg=null;
  D().date = D().date || isoStr();
  const el=$("dashDate"); el.value=D().date; el.max=isoStr();
  renderDash(); show("scrDash");
}
export function setDashDate(v){ D().date = v || isoStr(); renderDash(); }
export function toggleDashOrg(k){ D().openOrg = D().openOrg===k ? null : k; renderDash(); }

export function renderDash(){
  const dk=dayKeyOfIso(D().date||isoStr());

  /* Одоогийн нийт үлдэгдэл — хоёр хөргүүр нийлээд */
  const rows=[];
  liveItems().forEach(it=>{
    let kg=0,pcs=0; const per=[];
    db.fridges.forEach(fr=>{
      if((it.fridges||[1,2]).indexOf(fr.id)<0) return;
      const s=stock(fr.id,it.id);
      if(s.kg||s.pcs) per.push(fr.name+" "+qtyLine(s.kg,s.pcs,it.id));
      kg+=s.kg; pcs+=s.pcs;
    });
    if(kg||pcs) rows.push({it,kg,pcs,per});
  });
  $("dashStock").innerHTML = rows.length ? rows.map(r=>`
    <div class="item-row"><span class="item-name">${esc(r.it.name)}
      ${r.per.length>1?`<small>${esc(r.per.join(" · "))}</small>`:""}</span>
      <span class="item-val">${qtyLine(r.kg,r.pcs,r.it.id)}</span></div>`).join("")
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
    const g=gr[k], open=D().openOrg===k;
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
  db.log.forEach(e=>{
    if(e.action!=="in" || !e.worker || dayKey(e.ts)!==dk) return;
    pay[e.worker]=(pay[e.worker]||0)+payFor(e);
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
