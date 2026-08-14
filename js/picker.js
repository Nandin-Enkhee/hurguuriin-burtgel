/* Бараа сонгох жагсаалт — Оруулах, Гаргах, Худалдан авах гурав ижилхэн
   ажилладаг тул нэг л газар бичигдэнэ. Ялгаа нь бүртгэлээр дамжина. */
import { esc, int, f, itemsOf, itemName, isSack, perSackOf, hasKg, hasPcs,
         mainUnitOf, uShort, trackOf, sackNote, stock } from './util.js';
import { $ } from './ui.js';

const pickers = {};

/* cfg: { boxId, sel(), fridge(), items(), showStock, ignoreRc(),
          lineHTML(id), afterFields(id), onAdd(id), onChange() }
   items() өгвөл хөргүүрээс үл хамааран тэр жагсаалтыг ашиглана. */
export function registerPicker(ns,cfg){ pickers[ns]=cfg; }

export function blankQty(id){
  return { kg:"", pcs:"", per: isSack(id)&&perSackOf(id) ? String(perSackOf(id)) : "", sacks:"" };
}
/* Сонгосон нэгжээр илэрхийлсэн тоо хэмжээ */
export function qtyOf(v,id){
  if(!v) return 0;
  return mainUnitOf(id)==="pcs" ? int(v.pcs) : f(v.kg);
}
function syncSack(v,id){
  if(isSack(id)) v.pcs = String(int(v.per)*int(v.sacks));
}

function fieldsHTML(ns,id,v){
  const F=(key,label,step,mode,val)=>`
    <label class="fld">
      <input class="num-in" enterkeyhint="done" type="number" inputmode="${mode}" min="0" step="${step}"
             value="${esc(val)}" oninput="pickSet('${ns}','${id}','${key}',this.value)">
      <span>${label}</span>
    </label>`;
  if(isSack(id)){
    return F("per","ш/шуудай","1","numeric",v.per) + F("sacks","шуудай","1","numeric",v.sacks);
  }
  let h="";
  if(hasKg(id))  h += F("kg","кг","0.01","decimal",v.kg);
  if(hasPcs(id)) h += F("pcs","ш","1","numeric",v.pcs);
  return h;
}

export function renderPicker(ns){
  const cfg=pickers[ns];
  if(!cfg) return;
  const box=$(cfg.boxId);
  if(!box) return;
  const sel=cfg.sel();
  const items = cfg.items ? cfg.items() : itemsOf(cfg.fridge());

  if(!items.length){
    box.innerHTML = `<div class="empty">Энэ хөргүүрт ангилал тохируулаагүй байна.<br>Тохиргоо → Хөргүүрийн ангилал хэсгээс нэмнэ үү.</div>`;
    return;
  }
  box.innerHTML = items.map(it=>{
    const v=sel[it.id];
    const on=!!v;
    let note="";
    if(cfg.showStock){
      const s=stock(cfg.fridge(), it.id, cfg.ignoreRc?cfg.ignoreRc():null);
      let t = mainUnitOf(it.id)==="pcs" ? s.pcs+" ш" : s.kg+" кг";
      if(trackOf(it.id)==="both") t += " / "+s.pcs+" ш";
      const sn=sackNote(it.id,s.pcs);
      if(sn) t += " · "+sn;
      note=` <small>${t}</small>`;
    }
    let h=`<div class="pick">
      <button type="button" class="check-row${on?" on":""}" onclick="pickToggle('${ns}','${it.id}')">
        <span class="tick">✓</span><span>${esc(it.name)}${note}</span>
      </button>`;
    if(on){
      h+=`<div class="pick-fields">${fieldsHTML(ns,it.id,v)}</div>`;
      if(cfg.afterFields) h+=cfg.afterFields(it.id);
      if(cfg.lineHTML)    h+=`<div class="line-sum" id="ls_${ns}_${it.id}">${cfg.lineHTML(it.id)}</div>`;
    }
    return h+`</div>`;
  }).join("");
}

export function pickToggle(ns,id){
  const cfg=pickers[ns], sel=cfg.sel();
  if(sel[id]) delete sel[id];
  else{
    sel[id]=blankQty(id);
    if(cfg.onAdd) cfg.onAdd(id);
  }
  renderPicker(ns);
  if(cfg.onChange) cfg.onChange();
}
export function pickAll(ns,on){
  const cfg=pickers[ns], sel=cfg.sel();
  Object.keys(sel).forEach(k=>delete sel[k]);
  const all = cfg.items ? cfg.items() : itemsOf(cfg.fridge());
  if(on) all.forEach(it=>{
    sel[it.id]=blankQty(it.id);
    if(cfg.onAdd) cfg.onAdd(it.id);
  });
  renderPicker(ns);
  if(cfg.onChange) cfg.onChange();
}
export function pickSet(ns,id,key,val){
  const cfg=pickers[ns], sel=cfg.sel(), v=sel[id];
  if(!v) return;
  v[key]=val;
  syncSack(v,id);
  /* Талбарт бичиж байхад бүх жагсаалтыг дахин зурвал курсор алдагдана —
     зөвхөн доорх мөрийн тайлбарыг шинэчилнэ. */
  if(cfg.lineHTML){
    const el=$("ls_"+ns+"_"+id);
    if(el) el.textContent=cfg.lineHTML(id);
  }
  if(cfg.onChange) cfg.onChange();
}
