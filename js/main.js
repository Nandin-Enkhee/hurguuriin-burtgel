/* Бүх модулийг холбож, HTML доторх onclick-д хэрэгтэй функцуудыг нээнэ.
   Шинэ функц нэмэхдээ эндээ бүртгэхээ бүү мартаарай. */
import { loadLocal } from './state.js';
import * as UI       from './ui.js';
import * as Router   from './router.js';
import * as Picker   from './picker.js';
import * as Auth     from './auth.js';
import * as Fridge   from './fridge.js';
import * as Entry    from './entry.js';
import * as Work     from './work.js';
import * as Buy      from './buy.js';
import * as Out      from './out.js';
import * as Receipt  from './receipt.js';
import * as Dash     from './dash.js';
import * as Debt     from './debt.js';
import * as Records  from './records.js';
import * as Salary   from './salary.js';
import * as Settings from './settings.js';
import * as Count    from './count.js';
import * as XlsxExport from './xlsx-export.js';

loadLocal();

Object.assign(window,
  { show:Router.show, toggleSel:UI.toggleSel, chooseSel:UI.chooseSel,
    toggleMultiSel:UI.toggleMultiSel, closeKeyboard:UI.closeKeyboard },
  { pickToggle:Picker.pickToggle, pickSet:Picker.pickSet, pickAll:Picker.pickAll },
  Auth, Fridge, Entry, Work, Buy, Out, Receipt, Dash, Debt, Records, Salary, Settings, Count, XlsxExport
);

Auth.initLogin();
Auth.renderHome();
