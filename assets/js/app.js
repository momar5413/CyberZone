/* CyberZone — نواة التطبيق: الحالة، التنقل، النوافذ، الإشعارات، الصوت، والمؤقت الحي */
'use strict';

let state = null;

const UI_KEY = 'cyberzone.ui';
const ui = Object.assign({
  view: 'floor',
  floorStatus: 'all',
  floorType: 'all',
  floorSearch: '',
  shopCat: 'all',
  shopSearch: '',
  resTab: 'upcoming',
  range: '7d',
  from: '',
  to: '',
  histSearch: '',
  histLimit: 40,
  floorView: 'grid',
  mvKind: 'expense',
  demoHidden: false
}, readUi());

function readUi() {
  try { return JSON.parse(localStorage.getItem(UI_KEY)) || {}; } catch (e) { return {}; }
}
function saveUi() {
  try {
    const keep = { floorStatus: ui.floorStatus, floorType: ui.floorType, floorView: ui.floorView, shopCat: ui.shopCat, resTab: ui.resTab, range: ui.range, from: ui.from, to: ui.to, demoHidden: ui.demoHidden };
    localStorage.setItem(UI_KEY, JSON.stringify(keep));
  } catch (e) { /* تخزين غير متاح */ }
}

const $ = function (sel, root) { return (root || document).querySelector(sel); };
const $$ = function (sel, root) { return Array.from((root || document).querySelectorAll(sel)); };

/* ---------- الوصول للبيانات ---------- */

function cur() { return state.settings.currency; }
function money(n) { return fmtNum(n) + ' ' + cur(); }
function moneyHtml(n) { return '<span class="num">' + fmtNum(n) + '</span> <small>' + esc(cur()) + '</small>'; }

function typeOf(d) {
  return state.types.find(function (t) { return t.id === d.typeId; }) || { id: '', name: 'غير محدد', icon: 'monitor', rate: 0, rateMulti: null };
}
function deviceById(id) { return state.devices.find(function (d) { return d.id === id; }); }
function sessionById(id) { return state.sessions.find(function (s) { return s.id === id; }); }
function sessionOfDevice(id) { return state.sessions.find(function (s) { return s.deviceId === id; }); }
function productById(id) { return state.products.find(function (p) { return p.id === id; }); }
function resvById(id) { return state.reservations.find(function (r) { return r.id === id; }); }

function rateOf(d, mode) {
  const t = typeOf(d);
  if (mode === 'multi') {
    const m = d.rateMulti || t.rateMulti;
    if (m) return m;
  }
  return d.rate || t.rate || 0;
}
function hasMulti(d) { return !!(d.rateMulti || typeOf(d).rateMulti); }

function sessionTotals(s, now, opts) {
  const c = Billing.timeCharge(s, now, state.settings, opts);
  const items = Billing.itemsTotal(s.items);
  return { ms: c.ms, minutes: c.minutes, avgRate: c.avgRate, amount: c.amount, items: items, total: c.amount + items };
}

function sessionPhase(s, now) { return Billing.phase(s, now, state.settings.warnMinutes); }

function devicePhase(d, now) {
  if (d.maintenance) return 'maint';
  const s = sessionOfDevice(d.id);
  return s ? sessionPhase(s, now) : 'free';
}

const PHASE_LABEL = {
  free: ['متاح', 'go'],
  open: ['وقت مفتوح', 'run'],
  running: ['يلعب', 'run'],
  warn: ['ينتهي قريباً', 'amber'],
  over: ['انتهى الوقت', 'red'],
  paused: ['متوقف', 'idle'],
  maint: ['صيانة', 'idle']
};

/* ---------- الوردية ---------- */

function openShift() { return state.shifts.find(function (x) { return !x.closedAt; }) || null; }

function shiftDrawer(shift, now) {
  const to = shift.closedAt || now + 1;
  const recs = state.history.filter(function (r) { return r.endedAt >= shift.openedAt && r.endedAt < to; });
  const moves = state.cashMoves.filter(function (m) { return m.at >= shift.openedAt && m.at < to; });
  return Billing.drawer(shift.opening, recs, moves);
}

// الحجز الأقرب لجهاز: متأخر ضمن المهلة، أو يبدأ خلال windowMin دقيقة
function nextReservation(deviceId, now, windowMin) {
  const hold = state.settings.holdMinutes * Billing.MIN;
  return state.reservations
    .filter(function (r) {
      return r.status === 'booked' && r.deviceId === deviceId &&
        r.start + hold > now && r.start - now <= windowMin * Billing.MIN;
    })
    .sort(function (a, b) { return a.start - b.start; })[0] || null;
}

function resvState(r, now) {
  if (r.status !== 'booked') return r.status;
  const hold = state.settings.holdMinutes * Billing.MIN;
  if (now > r.start + r.minutes * Billing.MIN) return 'missed';
  if (now > r.start + hold) return 'late';
  if (now >= r.start) return 'due';
  if (r.start - now <= 60 * Billing.MIN) return 'soon';
  return 'later';
}

function resvConflicts(deviceId, start, minutes, excludeId) {
  const end = start + minutes * Billing.MIN;
  return state.reservations.filter(function (r) {
    if (r.id === excludeId || r.status !== 'booked' || r.deviceId !== deviceId) return false;
    const rEnd = r.start + r.minutes * Billing.MIN;
    return r.start < end && start < rEnd;
  });
}

function recentPlayers() {
  const seen = new Set();
  const out = [];
  for (let i = state.history.length - 1; i >= 0 && out.length < 30; i--) {
    const n = state.history[i].player;
    if (n && !seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out;
}

/* ---------- الحفظ ---------- */

let storageWarned = false;
let mutationSeq = 0;
function persist() {
  mutationSeq++;
  const ok = storage.write(state);
  if (!ok && !storageWarned) {
    storageWarned = true;
    renderBanners();
  }
}

/* ---------- التنقل ---------- */

const VIEWS = {
  floor: { title: 'الصالة', icon: 'grid', render: function () { renderFloor(); } },
  bookings: { title: 'الحجوزات', icon: 'calendar', render: function () { renderBookings(); } },
  shop: { title: 'البوفيه', icon: 'coffee', render: function () { renderShop(); } },
  cash: { title: 'الصندوق', icon: 'wallet', render: function () { renderCash(); } },
  reports: { title: 'التقارير', icon: 'chart', render: function () { renderReports(); } },
  settings: { title: 'الإعدادات', icon: 'settings', render: function () { renderSettings(); } }
};

function route() {
  const v = location.hash.replace('#', '');
  ui.view = VIEWS[v] ? v : 'floor';
  renderNav();
  renderView();
  const main = $('#view');
  if (main) main.scrollTop = 0;
}

function go(view) {
  if (location.hash !== '#' + view) location.hash = view;
  else route();
}

function renderNav() {
  const keys = Object.keys(VIEWS);
  $('#nav').innerHTML = keys.map(function (k) {
    const v = VIEWS[k];
    return '<a class="tab-link" href="#' + k + '"' + (ui.view === k ? ' aria-current="page"' : '') + '>' + v.title +
      '<b class="badge" data-badge="' + k + '" hidden></b></a>';
  }).join('');
  $('#tabbar').innerHTML = keys.map(function (k) {
    const v = VIEWS[k];
    return '<a class="tab" href="#' + k + '"' + (ui.view === k ? ' aria-current="page"' : '') + '>' + icon(v.icon) + '<span>' + v.title +
      '</span><b class="badge" data-badge="' + k + '" hidden></b></a>';
  }).join('');
  updateBadges(Date.now());
}

function renderView() {
  hideTooltip();
  renderBanners();
  VIEWS[ui.view].render();
  lastSignature = '';
}

function setTopbar(title, sub, actions) {
  $('#topbar').innerHTML =
    '<div style="min-width:0"><h1>' + title + '</h1>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>' +
    (actions ? '<div class="head-actions">' + actions + '</div>' : '');
}

function renderBanners() {
  const out = [];
  if (!storage.ok) {
    out.push('<div class="notice warn"><p><b>الحفظ غير متاح في هذا المتصفح.</b> الواجهة تعمل، لكن البيانات ستضيع عند إغلاق الصفحة. افتح التطبيق في نافذة عادية (غير خاصة) أو فعّل تخزين المواقع.</p></div>');
  }
  if (state.meta.demo && !ui.demoHidden) {
    out.push('<div class="notice"><p><b>بيانات تجريبية.</b> الأجهزة والجلسات والسجل هنا للتجربة فقط. عندما تجهز، أدخل أجهزة صالتك وأسعارها وابدأ من الصفر.</p>' +
      '<div class="row" style="gap:6px"><button class="btn btn-sm btn-primary" data-action="setup-open">جهّز صالتي</button>' +
      '<button class="btn btn-sm btn-ghost" data-action="demo-hide">إخفاء</button></div></div>');
  }
  $('#banners').innerHTML = out.join('');
}

function applyTheme() {
  const t = state.settings.theme;
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
  else root.removeAttribute('data-theme');
  const dark = t === 'dark' || (t === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const btn = $('#theme-btn');
  if (btn) {
    btn.innerHTML = icon(dark ? 'sun' : 'moon');
    btn.setAttribute('aria-label', dark ? 'التبديل إلى السمة الفاتحة' : 'التبديل إلى السمة الداكنة');
    btn.title = btn.getAttribute('aria-label');
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#141518' : '#e9ebee');
  Native.setBarsStyle(dark);
}

function applyBrand() {
  const name = state.settings.centerName.trim();
  const wm = $('#wordmark');
  if (/^cyber\s*zone$/i.test(name)) wm.innerHTML = 'CYBER<b>ZONE</b>';
  else wm.textContent = name;
  wm.setAttribute('aria-label', name);
  updateTitle(Date.now());
}

/* ---------- النوافذ ---------- */

let modal = null;
let lastFocus = null;

function openModal(opts) {
  const root = $('#modal-root');
  if (!modal) lastFocus = document.activeElement;
  root.innerHTML =
    '<div class="modal-backdrop" data-backdrop>' +
      '<div class="modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
        '<div class="modal-head">' +
          '<div style="flex:1;min-width:0"><h2 id="modal-title">' + opts.title + '</h2>' + (opts.sub ? '<div class="sub">' + opts.sub + '</div>' : '') + '</div>' +
          '<button type="button" class="btn btn-ghost btn-icon" data-action="modal-close" aria-label="إغلاق">' + icon('x') + '</button>' +
        '</div>' +
        '<form class="modal-form" novalidate style="display:contents">' +
          '<div class="modal-body">' + opts.body + '</div>' +
          (opts.foot ? '<div class="modal-foot">' + opts.foot + '</div>' : '') +
        '</form>' +
      '</div>' +
    '</div>';
  modal = { onSubmit: opts.onSubmit || null, onChange: opts.onChange || null, onClose: opts.onClose || null, key: opts.key || '' };
  const form = $('.modal-form', root);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (modal && modal.onSubmit) modal.onSubmit();
  });
  if (opts.onMount) opts.onMount($('.modal', root));
  if (modal.onChange) modal.onChange();
  const focusEl = $('[autofocus]', root) || $('.modal-body input, .modal-body select, .modal-body textarea', root) || $('.modal-foot .btn-primary', root);
  if (focusEl && !('ontouchstart' in window)) setTimeout(function () { focusEl.focus(); }, 30);
}

function closeModal() {
  const m = modal;
  modal = null;
  $('#modal-root').innerHTML = '';
  if (m && m.onClose) m.onClose();
  if (lastFocus && document.body.contains(lastFocus)) {
    try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* */ }
  }
}

function modalBody() { return $('#modal-root .modal-body'); }
function mval(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function mnum(id, fallback) { return num(mval(id), fallback); }
function pickValue(group) {
  const el = $('#modal-root [data-pick="' + group + '"][aria-pressed="true"]');
  return el ? el.dataset.value : null;
}

function askConfirm(opts, onYes) {
  openModal({
    title: opts.title,
    body: '<p class="muted" style="font-size:15px">' + opts.message + '</p>',
    foot: '<button type="submit" class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + ' btn-grow">' + (opts.confirm || 'تأكيد') + '</button>' +
      '<button type="button" class="btn" data-action="modal-close">تراجع</button>',
    onSubmit: function () { closeModal(); onYes(); }
  });
  setTimeout(function () { const b = $('#modal-root .modal-foot button[type="submit"]'); if (b) b.focus(); }, 40);
}

/* ---------- الإشعارات ---------- */

function toast(message, opts) {
  opts = opts || {};
  const type = opts.type || 'ok';
  const lamp = { ok: 'go', warn: 'amber', danger: 'red', info: 'brand' }[type] || 'brand';
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', type === 'danger' ? 'alert' : 'status');
  el.innerHTML = '<span class="lamp ' + lamp + '"></span><p></p>';
  el.querySelector('p').textContent = message;
  const actions = opts.actions || (opts.action ? [opts.action] : []);
  actions.forEach(function (a) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 't-act';
    b.textContent = a.label;
    b.addEventListener('click', function () { el.remove(); a.run(); });
    el.appendChild(b);
  });
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 't-x';
  x.setAttribute('aria-label', 'إغلاق');
  x.innerHTML = icon('x', 'ic-sm');
  x.addEventListener('click', function () { el.remove(); });
  el.appendChild(x);
  const box = $('#toasts');
  box.appendChild(el);
  while (box.children.length > 2) box.firstChild.remove();
  setTimeout(function () { el.remove(); }, opts.timeout || (actions.length ? 8000 : 4000));
}

/*
 * تراجع: تُحفظ نسخة من البيانات قبل العملية، ويمكن استعادتها ما لم يحدث تعديل آخر بعدها.
 * يغني عن نوافذ «هل أنت متأكد؟» للعمليات الفردية.
 */
function withUndo(run, message, extra) {
  const snap = JSON.stringify(state);
  run();
  const seq = mutationSeq;
  const actions = (extra || []).concat([{
    label: 'تراجع',
    run: function () {
      if (mutationSeq !== seq) { toast('لا يمكن التراجع بعد تعديل آخر', { type: 'warn' }); return; }
      state = normalizeState(JSON.parse(snap));
      persist();
      closeModal();
      refresh();
      toast('تم التراجع', { type: 'info' });
    }
  }]);
  toast(message, { actions: actions, timeout: 9000 });
}

/* ---------- الصوت والتنبيهات ---------- */

let audioCtx = null;
function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { audioCtx = null; }
}

function beep(kind, force) {
  if (!force && !state.settings.sound) return;
  if (!audioCtx) return;
  const seqs = {
    warn: [[740, 0, 0.18], [740, 0.28, 0.18]],
    over: [[880, 0, 0.22], [660, 0.3, 0.22], [880, 0.6, 0.22], [660, 0.9, 0.3]],
    ok: [[660, 0, 0.12], [990, 0.14, 0.2]]
  };
  const t0 = audioCtx.currentTime + 0.02;
  (seqs[kind] || seqs.ok).forEach(function (n) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = n[0];
    g.gain.setValueAtTime(0.0001, t0 + n[1]);
    g.gain.exponentialRampToValueAtTime(0.25, t0 + n[1] + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + n[2]);
    o.connect(g).connect(audioCtx.destination);
    o.start(t0 + n[1]);
    o.stop(t0 + n[1] + n[2] + 0.05);
  });
}

function systemNotify(title, body) {
  if (!state.settings.notify) return;
  try {
    if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body: body, tag: 'cz-' + title });
  } catch (e) { /* غير مدعوم */ }
}

function alertWarn(s) {
  const d = deviceById(s.deviceId);
  const left = Math.max(1, Math.ceil(Billing.remainingMs(s, Date.now()) / Billing.MIN));
  const msg = 'بقي ' + left + ' د على انتهاء وقت ' + (d ? d.name : '') + ' (' + s.player + ')';
  toast(msg, { type: 'warn', timeout: 7000 });
  beep('warn');
  systemNotify('ينتهي الوقت قريباً', msg);
}

function alertOver(s) {
  const d = deviceById(s.deviceId);
  const msg = 'انتهى وقت ' + (d ? d.name : '') + ' — ' + s.player;
  toast(msg, { type: 'danger', timeout: 10000, action: { label: 'إنهاء', run: function () { openCheckout(s.id); } } });
  beep('over');
  systemNotify('انتهى الوقت', msg);
}

/* ---------- المؤقت الحي ---------- */

let lastSignature = '';

function liveSignature(now) {
  const parts = state.sessions.map(function (s) { return s.id + ':' + sessionPhase(s, now); });
  state.reservations.forEach(function (r) { if (r.status === 'booked') parts.push(r.id + ':' + resvState(r, now)); });
  return parts.join('|');
}

function updateLive(now) {
  const map = {};
  state.sessions.forEach(function (s) { map[s.id] = s; });
  $$('[data-live]').forEach(function (el) {
    const kind = el.dataset.live;
    if (kind === 'pending') { el.textContent = fmtNum(pendingTotal(now)); return; }
    const s = map[el.dataset.sid];
    if (!s) return;
    if (kind === 'timer') {
      const rem = Billing.remainingMs(s, now);
      el.textContent = rem == null ? fmtClockDur(Billing.elapsedMs(s, now)) : (rem >= 0 ? fmtClockDur(rem) : '+' + fmtClockDur(-rem));
    } else if (kind === 'elapsed') {
      el.textContent = fmtClockDur(Billing.elapsedMs(s, now));
    } else if (kind === 'cost') {
      el.textContent = fmtNum(sessionTotals(s, now).total);
    } else if (kind === 'meter') {
      el.style.width = ledWidth(s, now);
    }
  });
}

// الشريط يفرغ مع الوقت المتبقي، مقرّباً لأقرب خانة من 24
function ledWidth(s, now) {
  if (!s.plannedMin) return '0%';
  const rem = Billing.remainingMs(s, now);
  if (rem <= 0) return '100%';
  const lit = Math.ceil(rem / (s.plannedMin * Billing.MIN) * 24);
  return (clamp(lit, 1, 24) / 24 * 100).toFixed(3) + '%';
}

function pendingTotal(now) {
  return state.sessions.reduce(function (a, s) { return a + sessionTotals(s, now).total; }, 0);
}

let lastMinute = -1;
function updateClock(now) {
  const minute = Math.floor(now / 60000);
  if (minute === lastMinute) return;
  lastMinute = minute;
  const d0 = new Date(now);
  const h = d0.getHours() % 12 || 12;
  $('#clock').textContent = h + ':' + pad2(d0.getMinutes());
  $('#clock-date').textContent = fmtDate(now, true) + ' · ' + (d0.getHours() < 12 ? 'صباحاً' : 'مساءً');
  renderShiftChip(now);
}

function renderShiftChip(now) {
  const chip = $('#shift-chip');
  if (!chip) return;
  const sh = openShift();
  if (sh) {
    chip.innerHTML = '<span class="lamp go"></span><span>وردية منذ ' + fmtTime(sh.openedAt) + '</span>';
    chip.title = 'الوردية مفتوحة منذ ' + fmtDur(now - sh.openedAt);
  } else {
    chip.innerHTML = '<span class="lamp"></span><span>لا وردية مفتوحة</span>';
    chip.title = 'افتح وردية لمتابعة النقد في الصندوق';
  }
}

function updateBadges(now) {
  let attention = 0;
  state.sessions.forEach(function (s) {
    const p = sessionPhase(s, now);
    if (p === 'warn' || p === 'over') attention++;
  });
  let resv = 0;
  state.reservations.forEach(function (r) {
    const st = resvState(r, now);
    if (st === 'soon' || st === 'due' || st === 'late') resv++;
  });
  $$('[data-badge="floor"]').forEach(function (b) { b.textContent = attention; b.hidden = !attention; });
  $$('[data-badge="bookings"]').forEach(function (b) { b.textContent = resv; b.hidden = !resv; b.classList.add('soft'); });
}

function updateTitle(now) {
  const over = state.sessions.filter(function (s) { return sessionPhase(s, now) === 'over'; }).length;
  document.title = over ? '(' + over + ') انتهى الوقت · ' + state.settings.centerName : state.settings.centerName + ' · إدارة الصالة';
}

function tick() {
  const now = Date.now();
  let changed = false;
  state.sessions.forEach(function (s) {
    const p = sessionPhase(s, now);
    if (p === 'warn' && !s.warned) { s.warned = true; changed = true; alertWarn(s); }
    if (p === 'over' && !s.overAlerted) { s.overAlerted = true; s.warned = true; changed = true; alertOver(s); }
  });
  if (changed) persist();
  updateClock(now);
  updateLive(now);
  const sig = liveSignature(now);
  if (sig !== lastSignature) {
    lastSignature = sig;
    if (ui.view === 'floor') refreshFloor();
    else if (ui.view === 'bookings' && !modal) renderBookings();
    updateBadges(now);
    updateTitle(now);
  }
}

/* ---------- الملفات ---------- */

function canPrint() {
  return !isFramed() && Native.canPrint;
}

function offerFile(filename, content, mime) {
  if (Native.any) {
    Native.saveFile(filename, content).then(function (r) {
      if (!r) { copyModal(filename, content); return; }
      if (r.path) toast('حُفظ الملف: ' + r.path);
    }).catch(function (err) {
      if (/cancel/i.test(String(err && (err.message || err)))) return;
      copyModal(filename, content);
    });
    return;
  }
  if (!isFramed()) {
    try {
      const blob = new Blob([content], { type: mime });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      toast('تم تنزيل ' + filename);
      return;
    } catch (e) { /* ننتقل للنسخ */ }
  }
  copyModal(filename, content);
}

function copyModal(filename, content) {
  openModal({
    title: 'نسخ ' + esc(filename),
    wide: true,
    body: '<p class="hint">تعذّر حفظ الملف مباشرة هنا. انسخ المحتوى والصقه في ملف باسم <b>' + esc(filename) + '</b>.</p>' +
      '<textarea class="textarea" id="f-export" readonly style="min-height:260px;direction:ltr;font-family:var(--font-mono);font-size:12px">' + esc(content) + '</textarea>',
    foot: '<button type="button" class="btn btn-primary" data-action="copy-export">' + icon('copy', 'ic-sm') + 'نسخ المحتوى</button><button type="button" class="btn" data-action="modal-close">إغلاق</button>'
  });
}

function copyText(text, el) {
  const done = function () { toast('تم النسخ'); };
  try {
    navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(el); });
  } catch (e) { fallbackCopy(el); }
}
function fallbackCopy(el) {
  if (el && el.select) { el.focus(); el.select(); toast('حدّد النص واضغط نسخ', { type: 'info' }); }
  else toast('تعذّر النسخ التلقائي', { type: 'warn' });
}

/* ---------- التلميحات (للرسوم البيانية) ---------- */

const chartTips = new Map();

function showTooltip(target, x, y) {
  const data = chartTips.get(target.dataset.tip);
  if (!data) return;
  const tt = $('#tooltip');
  tt.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'tt-title';
  title.textContent = data.title;
  tt.appendChild(title);
  data.rows.forEach(function (r) {
    const row = document.createElement('div');
    row.className = 'tt-row';
    if (r.key) {
      const k = document.createElement('i');
      k.className = 'tt-key';
      k.style.background = 'var(' + r.key + ')';
      row.appendChild(k);
    }
    const b = document.createElement('b');
    b.textContent = r.value;
    const s = document.createElement('span');
    s.textContent = r.label;
    row.appendChild(b);
    row.appendChild(s);
    tt.appendChild(row);
  });
  tt.hidden = false;
  positionTooltip(x, y);
}
function positionTooltip(x, y) {
  const tt = $('#tooltip');
  if (tt.hidden) return;
  const w = tt.offsetWidth;
  const h = tt.offsetHeight;
  let left = x + 14;
  if (left + w > window.innerWidth - 8) left = x - w - 14;
  let top = y - h - 12;
  if (top < 8) top = y + 16;
  tt.style.left = Math.max(8, left) + 'px';
  tt.style.top = top + 'px';
}
function hideTooltip() { const tt = $('#tooltip'); if (tt) tt.hidden = true; }

/* ---------- الأحداث ---------- */

function onClick(e) {
  const backdrop = e.target.closest('[data-backdrop]');
  if (backdrop && e.target === backdrop) { closeModal(); return; }

  const pick = e.target.closest('[data-pick]');
  if (pick) {
    e.preventDefault();
    const group = pick.dataset.pick;
    const scope = pick.closest('.modal, .view-root') || document;
    $$('[data-pick="' + group + '"]', scope).forEach(function (b) { b.setAttribute('aria-pressed', b === pick ? 'true' : 'false'); });
    if (modal && modal.onChange && pick.closest('.modal')) modal.onChange(group, pick.dataset.value);
    if (!pick.closest('.modal') && typeof onViewPick === 'function') onViewPick(group, pick.dataset.value);
    return;
  }

  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.action];
  if (fn) {
    e.preventDefault();
    fn(el, e);
  }
}

function onInput(e) {
  const t = e.target;
  if (t.closest && t.closest('.modal') && modal && modal.onChange) { modal.onChange(t.id); return; }
  if (t.id === 'floor-search') { ui.floorSearch = t.value; renderStations(); return; }
  if (t.id === 'shop-search') { ui.shopSearch = t.value; renderProducts(); return; }
  if (t.id === 'hist-search') { ui.histSearch = t.value; ui.histLimit = 40; renderHistoryTable(); return; }
}

function onChange(e) {
  const t = e.target;
  if (t.dataset && t.dataset.setting) { updateSetting(t); return; }
  if (t.dataset && t.dataset.typeField) { updateTypeField(t); return; }
  if (t.id === 'range-from' || t.id === 'range-to') {
    ui[t.id === 'range-from' ? 'from' : 'to'] = t.value;
    saveUi();
    renderReports();
    return;
  }
  if (t.id === 'import-file') { importBackup(t); return; }
}

const TAB_KEYS = ['floor', 'bookings', 'shop', 'cash', 'reports', 'settings'];

function typingTarget(el) {
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

function onKey(e) {
  if (e.key === 'Escape' && modal) { closeModal(); return; }
  if (!modal && !typingTarget(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const digit = /^Digit([1-6])$/.exec(e.code || '');
    if (digit) { e.preventDefault(); go(TAB_KEYS[Number(digit[1]) - 1]); return; }
    if (e.key === '/' || e.code === 'Slash' && !e.shiftKey) {
      const f = $('#view input[type="search"]');
      if (f) { e.preventDefault(); f.focus(); f.select(); }
      return;
    }
    if (e.key === '?' || (e.code === 'Slash' && e.shiftKey)) { e.preventDefault(); openShortcuts(); return; }
  }
  if (e.key === 'Tab' && modal) {
    const focusables = $$('#modal-root button:not([disabled]), #modal-root input:not([disabled]), #modal-root select, #modal-root textarea, #modal-root [tabindex="0"]').filter(function (x) { return x.offsetParent !== null; });
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

function onStorage(e) {
  if (e.key !== STORAGE_KEY || !e.newValue) return;
  try {
    const next = JSON.parse(e.newValue);
    if (isValidBackup(next)) {
      state = normalizeState(next);
      applyTheme();
      applyBrand();
      if (!modal) renderView();
    }
  } catch (err) { /* تجاهل */ }
}

function onPointerTip(e) {
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (e.type === 'pointerover' && t) showTooltip(t, e.clientX, e.clientY);
  else if (e.type === 'pointermove' && t) positionTooltip(e.clientX, e.clientY);
  else if (e.type === 'pointerout' && t) hideTooltip();
}

function onFocusTip(e) {
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (!t) return;
  if (e.type === 'focusin') {
    const r = t.getBoundingClientRect();
    showTooltip(t, r.left + r.width / 2, r.top + 10);
  } else hideTooltip();
}

/* ---------- التشغيل ---------- */

function boot() {
  document.documentElement.lang = 'ar';
  document.documentElement.dir = 'rtl';
  injectIconSprite();

  const saved = storage.read();
  if (saved && isValidBackup(saved)) state = normalizeState(saved);
  else {
    state = buildDemoState(Date.now());
    persist();
  }

  applyTheme();
  applyBrand();

  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  document.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', unlockAudio);
  document.addEventListener('keydown', unlockAudio, { once: true });
  document.addEventListener('pointerover', onPointerTip);
  document.addEventListener('pointermove', onPointerTip);
  document.addEventListener('pointerout', onPointerTip);
  document.addEventListener('focusin', onFocusTip);
  document.addEventListener('focusout', onFocusTip);
  window.addEventListener('hashchange', route);
  window.addEventListener('storage', onStorage);
  window.addEventListener('resize', debounce(function () { if (ui.view === 'reports') drawCharts(); }, 150));
  window.addEventListener('scroll', hideTooltip, { passive: true });
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', applyTheme);
  }

  route();
  tick();
  setInterval(tick, 1000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
