/* CyberZone — العمليات والنوافذ: الجلسات، الدفع، الطلبات، الحجوزات، الأجهزة، المنتجات، النسخ الاحتياطي */
'use strict';

const DURATIONS = [[0, 'وقت مفتوح', 'حسب الاستخدام'], [30, '30 د', ''], [60, 'ساعة', ''], [90, 'ساعة ونصف', ''], [120, 'ساعتان', ''], [180, '3 ساعات', ''], ['c', 'مخصص', 'بالدقائق']];

function ledMoney(n) {
  return fmtNum(n) + '<small style="font:600 12px var(--font-ui);color:var(--fg-3);margin-inline-start:4px">' + esc(cur()) + '</small>';
}

// أزرار المبالغ السريعة: المبلغ نفسه ثم أقرب أوراق نقدية أعلى منه
function quickCashHtml(total) {
  const seen = new Set();
  const opts = [total];
  [5000, 10000, 50000].forEach(function (b) { opts.push(Math.ceil(total / b) * b); });
  return opts.filter(function (v) { if (v <= 0 || seen.has(v)) return false; seen.add(v); return true; }).map(function (v, i) {
    return '<button type="button" class="chip" data-action="paid-set" data-value="' + v + '">' + (i === 0 ? 'المبلغ نفسه' : fmtNum(v)) + '</button>';
  }).join('');
}

function refresh() {
  if (ui.view === 'floor' && $('#stations')) refreshFloor();
  else renderView();
  lastSignature = '';
  updateBadges(Date.now());
  updateTitle(Date.now());
}

function opt(group, value, label, small, pressed) {
  return '<button type="button" class="option" data-pick="' + group + '" data-value="' + value + '" aria-pressed="' + (pressed ? 'true' : 'false') + '">' + label + (small ? '<small>' + small + '</small>' : '') + '</button>';
}

function fieldHtml(id, label, input, hint) {
  return '<label class="field" for="' + id + '"><span>' + label + '</span>' + input + (hint ? '<small>' + hint + '</small>' : '') + '</label>';
}

function moneyInput(id, value, placeholder) {
  return '<div class="input-affix"><input class="input" type="number" inputmode="numeric" min="0" step="any" id="' + id + '" value="' + (value == null ? '' : esc(value)) + '"' + (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') + '><span class="affix">' + esc(cur()) + '</span></div>';
}

function setError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg || ''; el.hidden = !msg; }
}

/* ---------- المخزون ---------- */

function takeStock(p, qty) {
  if (p.stock == null) return true;
  if (p.stock < qty) return false;
  p.stock -= qty;
  return true;
}
function returnStock(productId, qty) {
  const p = productById(productId);
  if (p && p.stock != null) p.stock += qty;
}
function addLine(items, p, qty) {
  const ex = items.find(function (i) { return i.productId === p.id; });
  if (ex) ex.qty += qty;
  else items.push({ productId: p.id, name: p.name, price: p.price, qty: qty });
}

/* =================== بدء جلسة =================== */

function openStartModal(deviceId, preset) {
  preset = preset || {};
  const d = deviceById(deviceId);
  if (!d) return;
  if (sessionOfDevice(d.id)) { toast('الجهاز مشغول بجلسة أخرى', { type: 'warn' }); return; }
  if (d.maintenance) { toast('الجهاز في وضع الصيانة. أعده للخدمة أولاً.', { type: 'warn' }); return; }
  const multi = hasMulti(d);
  const planned0 = preset.planned || 0;
  const standard = DURATIONS.some(function (x) { return x[0] === planned0; });
  const names = recentPlayers();

  openModal({
    title: 'بدء جلسة · ' + bdi(d.name),
    sub: esc(typeOf(d).name),
    body:
      '<div class="grid-2">' +
        fieldHtml('f-player', 'اسم اللاعب', '<input class="input" id="f-player" list="players-list" autocomplete="off" placeholder="زائر" value="' + esc(preset.player || '') + '" autofocus>') +
        fieldHtml('f-phone', 'رقم الهاتف <span class="faint">(اختياري)</span>', '<input class="input" id="f-phone" type="tel" dir="ltr" inputmode="tel" value="' + esc(preset.phone || '') + '">') +
      '</div>' +
      '<datalist id="players-list">' + names.map(function (n) { return '<option value="' + esc(n) + '"></option>'; }).join('') + '</datalist>' +
      (multi ? '<div class="stack-sm"><span class="field-label">نمط اللعب</span><div class="seg seg-block" role="group">' +
        '<button type="button" data-pick="mode" data-value="single" aria-pressed="true">' + icon('user', 'ic-sm') + 'فردي · ' + fmtNum(rateOf(d, 'single')) + '</button>' +
        '<button type="button" data-pick="mode" data-value="multi" aria-pressed="false">' + icon('users', 'ic-sm') + 'زوجي · ' + fmtNum(rateOf(d, 'multi')) + '</button>' +
      '</div></div>' : '') +
      '<div class="stack-sm"><span class="field-label">المدة</span><div class="option-grid cols-3">' +
        DURATIONS.map(function (x) { return opt('dur', x[0], x[1], x[2], standard ? x[0] === planned0 : x[0] === 'c'); }).join('').replace('class="option"', 'class="option option-wide"') +
      '</div>' +
      '<div id="custom-wrap"' + (standard ? ' hidden' : '') + '><div class="input-affix"><input class="input" type="number" min="5" step="5" id="f-custom" value="' + (standard ? 45 : planned0) + '"><span class="affix">دقيقة</span></div></div></div>' +
      '<div class="estimate"><div><div class="muted" style="font-size:13px;font-weight:700" id="est-label"></div><div class="faint" style="font-size:12px" id="est-note"></div></div><b id="est-value"></b></div>' +
      '<div id="start-warn"></div>',
    foot: '<button type="submit" class="btn btn-primary btn-lg">' + icon('play', 'ic-sm') + 'بدء الجلسة</button><button type="button" class="btn btn-lg" data-action="modal-close">إلغاء</button>',
    onChange: function () {
      const dur = pickValue('dur');
      $('#custom-wrap').hidden = dur !== 'c';
      const planned = dur === 'c' ? Math.max(5, Math.round(mnum('f-custom', 0))) : Number(dur) || 0;
      const mode = multi ? pickValue('mode') : 'single';
      const rate = rateOf(d, mode);
      const now = Date.now();
      if (planned) {
        const est = Billing.timeCharge({ rate: rate, segments: [], runSince: null, plannedMin: planned }, now, state.settings);
        $('#est-label').textContent = 'التكلفة المتوقعة لـ ' + fmtMinutes(planned);
        $('#est-note').textContent = 'تنتهي الساعة ' + fmtTime(now + planned * Billing.MIN) + ' · ' + fmtNum(rate) + ' ' + cur() + '/ساعة';
        $('#est-value').innerHTML = ledMoney(est.amount);
      } else {
        const minCost = Billing.timeCharge({ rate: rate, segments: [], runSince: null, plannedMin: null }, now, state.settings);
        $('#est-label').textContent = 'السعر بالساعة';
        $('#est-note').textContent = 'يُحسب حسب الوقت الفعلي' + (state.settings.minMinutes ? ' · الحد الأدنى ' + state.settings.minMinutes + ' د = ' + money(minCost.amount) : '');
        $('#est-value').innerHTML = ledMoney(rate);
      }
      const until = now + (planned || 180) * Billing.MIN;
      const clash = state.reservations.filter(function (r) {
        return r.status === 'booked' && r.deviceId === d.id && r.id !== preset.reservationId &&
          r.start < until && r.start + r.minutes * Billing.MIN > now;
      }).sort(function (a, b) { return a.start - b.start; })[0];
      $('#start-warn').innerHTML = clash
        ? '<div class="note-warn">' + icon('alert') + '<span>لدى هذا الجهاز حجز باسم <b>' + esc(clash.name) + '</b> الساعة ' + fmtTime(clash.start) + (planned ? ' يتقاطع مع مدة هذه الجلسة.' : '. انتبه عند اختيار الوقت المفتوح.') + '</span></div>'
        : '';
    },
    onSubmit: function () {
      const dur = pickValue('dur');
      const planned = dur === 'c' ? Math.max(5, Math.round(mnum('f-custom', 0))) : Number(dur) || 0;
      withUndo(function () {
        startSession(d, {
        player: mval('f-player').trim(),
        phone: mval('f-phone').trim(),
        mode: multi ? pickValue('mode') : 'single',
        planned: planned,
        reservationId: preset.reservationId
        });
      }, 'بدأت جلسة ' + d.name + (planned ? ' لمدة ' + fmtMinutes(planned) : ' بوقت مفتوح'));
    }
  });
}

function startSession(d, o) {
  const now = Date.now();
  const s = {
    id: uid(),
    deviceId: d.id,
    player: o.player || 'زائر',
    phone: o.phone || '',
    mode: o.mode || 'single',
    rate: rateOf(d, o.mode),
    plannedMin: o.planned || null,
    startedAt: now,
    segments: [],
    runSince: now,
    items: [],
    warned: false,
    overAlerted: false,
    reservationId: o.reservationId || null
  };
  state.sessions.push(s);
  if (s.reservationId) {
    const r = resvById(s.reservationId);
    if (r) r.status = 'started';
  }
  persist();
  closeModal();
  refresh();
  beep('ok');
  flashStation(d.id);
}

// البدء السريع من مفاتيح البطاقة: لاعب «زائر» ونمط فردي، مع تعديل أو تراجع من الإشعار
function quickStart(deviceId, minutes) {
  const d = deviceById(deviceId);
  if (!d || d.maintenance || sessionOfDevice(d.id)) return;
  let sid = null;
  withUndo(function () {
    startSession(d, { player: '', mode: 'single', planned: minutes || 0 });
    sid = sessionOfDevice(d.id).id;
  }, 'بدأت ' + d.name + (minutes ? ' لمدة ' + fmtMinutes(minutes) : ' بوقت مفتوح'), [{ label: 'الاسم والنمط', run: function () { openSessionEdit(sid); } }]);
}

function flashStation(deviceId) {
  const el = document.querySelector('.station[data-device="' + CSS.escape(deviceId) + '"]');
  if (!el) return;
  el.classList.add('flash');
  setTimeout(function () { el.classList.remove('flash'); }, 900);
}

/* =================== إنهاء وحساب =================== */

function openCheckout(sessionId) {
  const s = sessionById(sessionId);
  if (!s) return;
  const d = deviceById(s.deviceId);
  const at = Date.now();
  const elapsed = Billing.elapsedMs(s, at);
  const canIgnore = !!s.plannedMin && elapsed < s.plannedMin * Billing.MIN;
  let paidTouched = false;
  let calc = null;

  openModal({
    title: 'إنهاء وحساب · ' + bdi(d ? d.name : ''),
    sub: esc(s.player) + (s.phone ? ' · <span dir="ltr">' + esc(s.phone) + '</span>' : ''),
    body:
      '<div class="info-grid">' +
        infoCell('البداية', fmtTime(s.startedAt)) +
        infoCell('النهاية', fmtTime(at)) +
        infoCell('مدة اللعب الفعلية', fmtDur(elapsed) + ' <span class="faint hud" style="font-size:12px">' + fmtClockDur(elapsed) + '</span>') +
        infoCell(s.plannedMin ? 'المدة المحجوزة' : 'نوع الجلسة', s.plannedMin ? fmtMinutes(s.plannedMin) : 'وقت مفتوح') +
      '</div>' +
      (canIgnore ? '<label class="check"><input type="checkbox" id="f-actual"> احتساب الوقت الفعلي فقط بدل المدة المحجوزة</label>' : '') +
      (s.items.length ? '<div class="stack-sm"><span class="field-label">طلبات البوفيه</span><div class="sum-rows">' + s.items.map(function (i) {
        return '<div class="sum-row"><span>' + esc(i.name) + ' <span class="faint num">× ' + i.qty + '</span></span><span>' + fmtNum(i.price * i.qty) + '</span></div>';
      }).join('') + '</div></div>' : '') +
      '<div class="grid-2">' +
        fieldHtml('f-discount', 'خصم', moneyInput('f-discount', '', '0')) +
        fieldHtml('f-paid', 'المبلغ المدفوع', moneyInput('f-paid', '')) +
      '</div>' +
      '<div class="quick-cash" id="quick-cash"></div>' +
      '<div class="stack-sm"><span class="field-label">طريقة الدفع</span><div class="seg seg-block" role="group">' +
        '<button type="button" data-pick="pay" data-value="cash" aria-pressed="true">' + icon('banknote', 'ic-sm') + 'نقدي</button>' +
        '<button type="button" data-pick="pay" data-value="card" aria-pressed="false">' + icon('wallet', 'ic-sm') + 'دفع إلكتروني</button>' +
      '</div></div>' +
      fieldHtml('f-note', 'ملاحظة <span class="faint">(اختياري)</span>', '<input class="input" id="f-note" autocomplete="off">') +
      '<div class="sum-rows" id="co-sum"></div>' +
      '<div class="note-warn" id="co-err" hidden></div>',
    foot: '<button type="submit" class="btn btn-primary btn-lg">' + icon('check', 'ic-sm') + 'تأكيد الدفع وإنهاء الجلسة</button><button type="button" class="btn btn-lg" data-action="modal-close">رجوع</button>',
    onChange: function (id) {
      if (id === 'f-paid') paidTouched = true;
      const ignore = canIgnore && $('#f-actual') && $('#f-actual').checked;
      const t = sessionTotals(s, at, { ignorePlanned: ignore });
      const discount = clamp(Math.round(mnum('f-discount', 0)), 0, t.total);
      const total = t.total - discount;
      if (!paidTouched) $('#f-paid').value = total;
      const paid = mval('f-paid') === '' ? total : Math.round(mnum('f-paid', total));
      if (!calc || calc.total !== total) $('#quick-cash').innerHTML = quickCashHtml(total);
      calc = { t: t, discount: discount, total: total, paid: paid, ignore: ignore };
      const change = paid - total;
      $('#co-sum').innerHTML =
        '<div class="sum-row"><span>أجرة الوقت <span class="faint">(' + t.minutes + ' د محتسبة × ' + fmtNum(t.avgRate) + '/ساعة)</span></span><span>' + fmtNum(t.amount) + '</span></div>' +
        (t.items ? '<div class="sum-row"><span>البوفيه</span><span>' + fmtNum(t.items) + '</span></div>' : '') +
        (discount ? '<div class="sum-row discount"><span>الخصم</span><span dir="ltr">−' + fmtNum(discount) + '</span></div>' : '') +
        '<div class="sum-row total"><span>الإجمالي</span><span>' + ledMoney(total) + '</span></div>' +
        (change > 0 ? '<div class="sum-row"><span>الباقي للزبون</span><span style="color:var(--go)">' + money(change) + '</span></div>' : '') +
        (change < 0 ? '<div class="sum-row"><span>ناقص</span><span style="color:var(--red)">' + money(-change) + '</span></div>' : '');
      setError('co-err', '');
    },
    onSubmit: function () {
      if (!calc) return;
      if (calc.paid < calc.total) {
        $('#co-err').innerHTML = icon('alert') + '<span>المبلغ المدفوع أقل من الإجمالي بـ ' + money(calc.total - calc.paid) + '. عدّل المبلغ أو أضف خصماً.</span>';
        $('#co-err').hidden = false;
        return;
      }
      finishSession(s, at, calc, pickValue('pay'), mval('f-note').trim());
    }
  });
}

function infoCell(label, value) {
  return '<div class="info-cell"><span>' + label + '</span><b>' + value + '</b></div>';
}

function finishSession(s, at, calc, method, note) {
  const d = deviceById(s.deviceId);
  const t = typeOf(d || {});
  const rec = {
    id: uid(),
    no: state.meta.receiptSeq + 1,
    kind: 'session',
    deviceId: s.deviceId,
    deviceName: d ? d.name : 'جهاز محذوف',
    typeName: t.name,
    player: s.player,
    phone: s.phone,
    mode: s.mode,
    plannedMin: s.plannedMin,
    startedAt: s.startedAt,
    endedAt: at,
    playedMs: calc.t.ms,
    billedMinutes: calc.t.minutes,
    avgRate: Math.round(calc.t.avgRate),
    timeAmount: calc.t.amount,
    items: s.items.map(function (i) { return Object.assign({}, i); }),
    itemsAmount: calc.t.items,
    discount: calc.discount,
    total: calc.total,
    paid: calc.paid,
    method: method || 'cash',
    note: note || ''
  };
  withUndo(function () {
    state.meta.receiptSeq = rec.no;
    state.history.push(rec);
    state.sessions = state.sessions.filter(function (x) { return x.id !== s.id; });
    if (s.reservationId) {
      const r = resvById(s.reservationId);
      if (r) r.status = 'done';
    }
    persist();
    closeModal();
    refresh();
    beep('ok');
  }, 'انتهت جلسة ' + rec.deviceName + ' — ' + money(rec.total), [{ label: 'الإيصال', run: function () { openReceipt(rec.id); } }]);
}

/* =================== طلبات البوفيه لجلسة =================== */

let orderCat = 'all';

function openOrder(sessionId) {
  const s = sessionById(sessionId);
  if (!s) return;
  const d = deviceById(s.deviceId);
  openModal({
    title: 'طلبات · ' + bdi(d ? d.name : ''),
    sub: esc(s.player) + ' · تُضاف إلى حساب الجلسة',
    wide: true,
    body: '',
    foot: '<button type="button" class="btn btn-primary btn-lg" data-action="modal-close">' + icon('check', 'ic-sm') + 'تم</button>'
  });
  modal.sid = sessionId;
  renderOrderBody();
}

function renderOrderBody() {
  const s = modal && sessionById(modal.sid);
  const box = modalBody();
  if (!s || !box) return;
  const list = state.products.filter(function (p) { return orderCat === 'all' || p.category === orderCat; });
  box.innerHTML =
    '<div class="type-chips" style="margin:0">' +
      '<button type="button" class="chip" data-action="order-cat" data-value="all" aria-pressed="' + (orderCat === 'all') + '">الكل</button>' +
      PRODUCT_CATEGORIES.map(function (c) { return '<button type="button" class="chip" data-action="order-cat" data-value="' + c.id + '" aria-pressed="' + (orderCat === c.id) + '">' + c.name + '</button>'; }).join('') +
    '</div>' +
    (list.length ? '<div class="option-grid" style="grid-template-columns:repeat(auto-fill,minmax(128px,1fr))">' + list.map(function (p) {
      const out = p.stock != null && p.stock <= 0;
      return '<button type="button" class="option" data-action="order-add" data-id="' + p.id + '"' + (out ? ' disabled style="opacity:.45"' : '') + '>' + esc(p.name) +
        '<small class="num">' + fmtNum(p.price) + (p.stock != null ? ' · ' + (out ? 'نفد' : 'متبقٍ ' + p.stock) : '') + '</small></button>';
    }).join('') + '</div>' : '<div class="empty">لا منتجات في هذه الفئة</div>') +
    '<div class="stack-sm"><span class="field-label">على الحساب</span>' +
    (s.items.length ? '<div class="cart-lines">' + s.items.map(function (i) {
      return '<div class="cart-line"><div class="item-main"><div class="item-title">' + esc(i.name) + '</div><div class="item-sub num">' + fmtNum(i.price) + ' × ' + i.qty + '</div></div>' +
        '<div class="qty"><button type="button" class="btn btn-icon btn-sm" data-action="order-dec" data-id="' + i.productId + '" aria-label="إنقاص">' + icon('minus', 'ic-sm') + '</button><b>' + i.qty + '</b>' +
        '<button type="button" class="btn btn-icon btn-sm" data-action="order-inc" data-id="' + i.productId + '" aria-label="زيادة">' + icon('plus', 'ic-sm') + '</button></div>' +
        '<b class="num" style="min-width:70px;text-align:end">' + fmtNum(i.price * i.qty) + '</b></div>';
    }).join('') + '</div><div class="sum-rows"><div class="sum-row total"><span>مجموع الطلبات</span><span>' + ledMoney(Billing.itemsTotal(s.items)) + '</span></div></div>'
      : '<div class="hint">لا طلبات بعد. اضغط على منتج لإضافته.</div>') +
    '</div>';
}

function orderChange(productId, delta) {
  const s = modal && sessionById(modal.sid);
  if (!s) return;
  const p = productById(productId);
  if (delta > 0) {
    if (!p) return;
    if (!takeStock(p, delta)) { toast('نفد مخزون ' + p.name, { type: 'warn' }); return; }
    addLine(s.items, p, delta);
  } else {
    const line = s.items.find(function (i) { return i.productId === productId; });
    if (!line) return;
    line.qty += delta;
    returnStock(productId, -delta);
    if (line.qty <= 0) s.items = s.items.filter(function (i) { return i !== line; });
  }
  persist();
  renderOrderBody();
  if (ui.view === 'floor') refreshFloor();
}

/* =================== التمديد وتحديد المدة =================== */

function openExtend(sessionId) {
  const s = sessionById(sessionId);
  if (!s) return;
  const d = deviceById(s.deviceId);
  const now = Date.now();
  const elapsedMin = Billing.elapsedMs(s, now) / Billing.MIN;
  if (s.plannedMin) {
    const adds = [[15, '+15 د'], [30, '+30 د'], [60, '+ساعة'], [90, '+ساعة ونصف'], [120, '+ساعتان'], [180, '+3 ساعات']];
    openModal({
      title: 'تمديد الوقت · ' + bdi(d ? d.name : ''),
      sub: esc(s.player) + ' · المدة الحالية ' + fmtMinutes(s.plannedMin),
      body: '<div class="option-grid cols-3">' + adds.map(function (a, i) { return opt('ext', a[0], a[1], '', i === 1); }).join('') + '</div>' +
        '<div class="estimate"><div><div class="muted" style="font-size:13px;font-weight:700">المدة الجديدة</div><div class="faint" style="font-size:12px" id="ext-note"></div></div><b id="ext-value"></b></div>' +
        '<button type="button" class="menu-item" data-action="to-open" data-session="' + s.id + '">' + icon('clock') + '<span>تحويل إلى وقت مفتوح<small>يستمر العدّ ويُحسب حسب الوقت الفعلي</small></span></button>',
      foot: '<button type="submit" class="btn btn-primary btn-lg">' + icon('plus', 'ic-sm') + 'تمديد</button><button type="button" class="btn btn-lg" data-action="modal-close">إلغاء</button>',
      onChange: function () {
        const add = Number(pickValue('ext')) || 0;
        const total = s.plannedMin + add;
        const rem = total * Billing.MIN - Billing.elapsedMs(s, Date.now());
        $('#ext-value').textContent = fmtMinutes(total);
        $('#ext-note').textContent = s.runSince == null ? 'الجلسة متوقفة مؤقتاً' : 'تنتهي الساعة ' + fmtTime(Date.now() + rem);
      },
      onSubmit: function () { setPlanned(s, s.plannedMin + (Number(pickValue('ext')) || 0)); }
    });
  } else {
    const totals = [30, 60, 90, 120, 180, 240].filter(function (m) { return m > elapsedMin + 1; });
    openModal({
      title: 'تحديد مدة · ' + bdi(d ? d.name : ''),
      sub: esc(s.player) + ' · يلعب منذ ' + fmtDur(elapsedMin * Billing.MIN),
      body: '<p class="hint">حوّل الجلسة المفتوحة إلى مدة محددة ليظهر عدّاد تنازلي وتنبيه قبل الانتهاء. اختر المدة الإجمالية منذ بدء الجلسة.</p>' +
        '<div class="option-grid cols-3">' + totals.map(function (m, i) { return opt('setdur', m, fmtMinutes(m), '', i === 0); }).join('') + '</div>' +
        '<div class="estimate"><div><div class="muted" style="font-size:13px;font-weight:700">تنتهي الساعة</div></div><b id="ext-value"></b></div>',
      foot: '<button type="submit" class="btn btn-primary btn-lg"' + (totals.length ? '' : ' disabled') + '>' + icon('timer', 'ic-sm') + 'تحديد المدة</button><button type="button" class="btn btn-lg" data-action="modal-close">إلغاء</button>',
      onChange: function () {
        const m = Number(pickValue('setdur')) || 0;
        const rem = m * Billing.MIN - Billing.elapsedMs(s, Date.now());
        $('#ext-value').textContent = m ? fmtTime(Date.now() + rem) : '—';
      },
      onSubmit: function () {
        const m = Number(pickValue('setdur'));
        if (m) setPlanned(s, m);
      }
    });
  }
}

function setPlanned(s, minutes) {
  s.plannedMin = minutes || null;
  const rem = Billing.remainingMs(s, Date.now());
  if (rem == null || rem > 0) s.overAlerted = false;
  if (rem == null || rem > state.settings.warnMinutes * Billing.MIN) s.warned = false;
  persist();
  closeModal();
  refresh();
  const d = deviceById(s.deviceId);
  toast(minutes ? 'مدة ' + (d ? d.name : '') + ' أصبحت ' + fmtMinutes(minutes) : 'أصبحت جلسة ' + (d ? d.name : '') + ' وقتاً مفتوحاً');
}

function togglePause(sessionId) {
  const s = sessionById(sessionId);
  if (!s) return;
  const d = deviceById(s.deviceId);
  const now = Date.now();
  if (s.runSince == null) {
    Billing.resume(s, now);
    toast('استُؤنفت جلسة ' + (d ? d.name : ''));
  } else {
    Billing.pause(s, now);
    toast('أُوقفت جلسة ' + (d ? d.name : '') + ' مؤقتاً. الوقت لا يُحتسب أثناء الإيقاف.', { type: 'info' });
  }
  persist();
  refresh();
}

/* =================== خيارات الجلسة =================== */

function openSessionMenu(sessionId) {
  const s = sessionById(sessionId);
  if (!s) return;
  const d = deviceById(s.deviceId);
  const now = Date.now();
  const tot = sessionTotals(s, now);
  openModal({
    title: bdi(d ? d.name : '') + ' · ' + esc(s.player),
    sub: 'بدأت ' + fmtTime(s.startedAt) + ' · الحساب حتى الآن ' + money(tot.total),
    body: '<div class="menu-list">' +
      '<button type="button" class="menu-item" data-action="session-edit" data-session="' + s.id + '">' + icon('pencil') + '<span>تعديل بيانات الجلسة<small>الاسم، الهاتف' + (hasMulti(d || {}) ? '، نمط اللعب (فردي/زوجي)' : '') + '</small></span></button>' +
      '<button type="button" class="menu-item" data-action="session-transfer" data-session="' + s.id + '">' + icon('swap') + '<span>نقل إلى جهاز آخر<small>يُحفظ الوقت السابق بسعره ويُكمل بسعر الجهاز الجديد</small></span></button>' +
      '<button type="button" class="menu-item" data-action="order" data-session="' + s.id + '">' + icon('coffee') + '<span>طلبات البوفيه<small>' + (s.items.length ? s.items.length + ' صنف على الحساب' : 'لا طلبات بعد') + '</small></span></button>' +
      '<button type="button" class="menu-item danger" data-action="session-cancel" data-session="' + s.id + '">' + icon('trash') + '<span>إلغاء الجلسة دون حساب<small>للجلسات المفتوحة بالخطأ. تُعاد الطلبات إلى المخزون ويمكن التراجع</small></span></button>' +
    '</div>'
  });
}

function openSessionEdit(sessionId) {
  const s = sessionById(sessionId);
  if (!s) return;
  const d = deviceById(s.deviceId);
  const multi = hasMulti(d || {});
  openModal({
    title: 'تعديل الجلسة · ' + bdi(d ? d.name : ''),
    body: '<div class="grid-2">' +
        fieldHtml('f-player', 'اسم اللاعب', '<input class="input" id="f-player" value="' + esc(s.player) + '" autocomplete="off">') +
        fieldHtml('f-phone', 'رقم الهاتف', '<input class="input" id="f-phone" type="tel" dir="ltr" value="' + esc(s.phone || '') + '">') +
      '</div>' +
      (multi ? '<div class="stack-sm"><span class="field-label">نمط اللعب</span><div class="seg seg-block" role="group">' +
        '<button type="button" data-pick="mode" data-value="single" aria-pressed="' + (s.mode !== 'multi') + '">فردي · ' + fmtNum(rateOf(d, 'single')) + '</button>' +
        '<button type="button" data-pick="mode" data-value="multi" aria-pressed="' + (s.mode === 'multi') + '">زوجي · ' + fmtNum(rateOf(d, 'multi')) + '</button>' +
        '</div><small class="hint">عند تغيير النمط يُحسب الوقت السابق بسعره القديم والباقي بالسعر الجديد.</small></div>' : ''),
    foot: '<button type="submit" class="btn btn-primary">حفظ</button><button type="button" class="btn" data-action="modal-close">إلغاء</button>',
    onSubmit: function () {
      s.player = mval('f-player').trim() || 'زائر';
      s.phone = mval('f-phone').trim();
      if (multi) {
        const mode = pickValue('mode');
        if (mode !== s.mode) {
          Billing.changeRate(s, rateOf(d, mode), Date.now());
          s.mode = mode;
        }
      }
      persist();
      closeModal();
      refresh();
      toast('حُفظت بيانات الجلسة');
    }
  });
}

function openTransfer(sessionId) {
  const s = sessionById(sessionId);
  if (!s) return;
  const from = deviceById(s.deviceId);
  const free = state.devices.filter(function (d) { return !d.maintenance && !sessionOfDevice(d.id); });
  openModal({
    title: 'نقل الجلسة',
    sub: 'من ' + bdi(from ? from.name : '') + ' · ' + esc(s.player),
    body: free.length ? '<div class="menu-list">' + free.map(function (d) {
      const mode = hasMulti(d) ? s.mode : 'single';
      return '<button type="button" class="menu-item" data-action="transfer-to" data-session="' + s.id + '" data-device="' + esc(d.id) + '">' + icon(typeOf(d).icon || 'monitor') +
        '<span>' + bdi(d.name) + '<small>' + esc(typeOf(d).name) + ' · ' + money(rateOf(d, mode)) + '/ساعة' + (mode !== s.mode ? ' (فردي)' : '') + '</small></span></button>';
    }).join('') + '</div>' : '<div class="empty">' + icon('monitor') + '<span>لا توجد أجهزة متاحة حالياً.</span></div>'
  });
}

function transferTo(sessionId, deviceId) {
  const s = sessionById(sessionId);
  const d = deviceById(deviceId);
  if (!s || !d || sessionOfDevice(d.id)) return;
  const from = deviceById(s.deviceId);
  const mode = hasMulti(d) ? s.mode : 'single';
  Billing.changeRate(s, rateOf(d, mode), Date.now());
  s.mode = mode;
  s.deviceId = d.id;
  persist();
  closeModal();
  refresh();
  toast('نُقلت الجلسة من ' + (from ? from.name : '') + ' إلى ' + d.name);
  flashStation(d.id);
}

function cancelSession(sessionId) {
  const s = sessionById(sessionId);
  if (!s) return;
  const d = deviceById(s.deviceId);
  withUndo(function () {
    s.items.forEach(function (i) { returnStock(i.productId, i.qty); });
    state.sessions = state.sessions.filter(function (x) { return x.id !== s.id; });
    if (s.reservationId) {
      const r = resvById(s.reservationId);
      if (r) r.status = 'booked';
    }
    persist();
    closeModal();
    refresh();
  }, 'أُلغيت جلسة ' + (d ? d.name : '') + ' دون حساب');
}

/* =================== الأجهزة =================== */

function openDeviceModal(deviceId) {
  const d = deviceId ? deviceById(deviceId) : null;
  const typeId = d ? d.typeId : (state.types[0] && state.types[0].id);
  const active = d && sessionOfDevice(d.id);
  openModal({
    title: d ? 'تعديل الجهاز' : 'إضافة جهاز',
    body:
      fieldHtml('f-name', 'اسم الجهاز', '<input class="input" id="f-name" autocomplete="off" placeholder="مثال: PS5 · 5" value="' + esc(d ? d.name : suggestDeviceName(typeId)) + '">') +
      '<div id="f-name-err" class="note-warn" hidden></div>' +
      fieldHtml('f-type', 'النوع', '<select class="select input" id="f-type">' + state.types.map(function (t) {
        return '<option value="' + esc(t.id) + '"' + (t.id === typeId ? ' selected' : '') + '>' + esc(t.name) + '</option>';
      }).join('') + '</select>', 'الأسعار الافتراضية لكل نوع تُعدّل من الإعدادات.') +
      '<div class="grid-2">' +
        fieldHtml('f-rate', 'سعر خاص للساعة (فردي)', moneyInput('f-rate', d && d.rate ? d.rate : ''), '<span id="rate-hint"></span>') +
        '<div id="multi-wrap">' + fieldHtml('f-rate-multi', 'سعر خاص (زوجي)', moneyInput('f-rate-multi', d && d.rateMulti ? d.rateMulti : ''), '<span id="rate-multi-hint"></span>') + '</div>' +
      '</div>' +
      fieldHtml('f-note', 'ملاحظة <span class="faint">(اختياري)</span>', '<input class="input" id="f-note" value="' + esc(d ? d.note || '' : '') + '" placeholder="مثال: شاشة 75 إنش">') +
      '<label class="check"><input type="checkbox" id="f-maint"' + (d && d.maintenance ? ' checked' : '') + (active ? ' disabled' : '') + '> الجهاز في الصيانة (خارج الخدمة)</label>',
    foot: '<button type="submit" class="btn btn-primary">' + (d ? 'حفظ التعديلات' : 'إضافة الجهاز') + '</button>' +
      (d ? '<button type="button" class="btn btn-danger" data-action="device-delete" data-device="' + esc(d.id) + '"' + (active ? ' disabled title="أنهِ الجلسة الجارية أولاً"' : '') + '>' + icon('trash', 'ic-sm') + 'حذف</button>' : '') +
      '<button type="button" class="btn" data-action="modal-close">إلغاء</button>',
    onChange: function (id) {
      const t = state.types.find(function (x) { return x.id === mval('f-type'); }) || {};
      $('#rate-hint').textContent = 'اتركه فارغاً لاستخدام سعر النوع: ' + money(t.rate || 0);
      $('#multi-wrap').hidden = !t.rateMulti;
      $('#rate-multi-hint').textContent = t.rateMulti ? 'سعر النوع: ' + money(t.rateMulti) : '';
      if (id === 'f-type' && !d) $('#f-name').value = suggestDeviceName(t.id);
    },
    onSubmit: function () {
      const name = mval('f-name').trim();
      if (!name) { setErrorHtml('f-name-err', 'اكتب اسماً للجهاز.'); return; }
      const dup = state.devices.find(function (x) { return x.name === name && (!d || x.id !== d.id); });
      if (dup) { setErrorHtml('f-name-err', 'يوجد جهاز آخر بالاسم نفسه. اختر اسماً مختلفاً.'); return; }
      const t = state.types.find(function (x) { return x.id === mval('f-type'); });
      const rec = d || { id: uid(), maintenance: false };
      rec.name = name;
      rec.typeId = t ? t.id : '';
      rec.rate = Math.round(mnum('f-rate', 0)) || null;
      rec.rateMulti = t && t.rateMulti ? (Math.round(mnum('f-rate-multi', 0)) || null) : null;
      rec.note = mval('f-note').trim();
      if (!active) rec.maintenance = $('#f-maint').checked;
      if (!d) state.devices.push(rec);
      persist();
      closeModal();
      refresh();
      toast(d ? 'حُفظ ' + name : 'أُضيف ' + name);
      if (!d) flashStation(rec.id);
    }
  });
}

function setErrorHtml(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = icon('alert') + '<span>' + esc(msg) + '</span>';
  el.hidden = false;
}

function suggestDeviceName(typeId) {
  const prefix = { ps5: 'PS5', ps4: 'PS4', xbox: 'Xbox', pc: 'PC', vr: 'VR' }[typeId] ||
    ((state.types.find(function (t) { return t.id === typeId; }) || {}).name || 'جهاز');
  let n = 1;
  const names = new Set(state.devices.map(function (d) { return d.name; }));
  while (names.has(prefix + ' · ' + n)) n++;
  return prefix + ' · ' + n;
}

function openDeviceMenu(deviceId) {
  const d = deviceById(deviceId);
  if (!d) return;
  const busy = !!sessionOfDevice(d.id);
  openModal({
    title: bdi(d.name),
    sub: esc(typeOf(d).name) + ' · ' + money(rateOf(d, 'single')) + '/ساعة',
    body: '<div class="menu-list">' +
      (busy || d.maintenance ? '' : '<button type="button" class="menu-item" data-action="start-session" data-device="' + esc(d.id) + '">' + icon('play') + '<span>بدء جلسة بخيارات<small>اسم اللاعب، فردي أو زوجي، مدة مخصصة</small></span></button>') +
      '<button type="button" class="menu-item" data-action="device-edit" data-device="' + esc(d.id) + '">' + icon('pencil') + '<span>تعديل الجهاز<small>الاسم، النوع، السعر الخاص</small></span></button>' +
      '<button type="button" class="menu-item" data-action="resv-new" data-device="' + esc(d.id) + '">' + icon('calendarPlus') + '<span>حجز هذا الجهاز<small>لموعد لاحق</small></span></button>' +
      (busy ? '' : '<button type="button" class="menu-item" data-action="maint-toggle" data-device="' + esc(d.id) + '">' + icon('wrench') + '<span>' + (d.maintenance ? 'إعادة للخدمة' : 'وضع الصيانة') + '<small>' + (d.maintenance ? 'يعود الجهاز متاحاً للجلسات' : 'يُخفى من الأجهزة المتاحة حتى إصلاحه') + '</small></span></button>') +
      '<button type="button" class="menu-item danger" data-action="device-delete" data-device="' + esc(d.id) + '"' + (busy ? ' disabled' : '') + '>' + icon('trash') + '<span>حذف الجهاز<small>' + (busy ? 'أنهِ الجلسة الجارية أولاً' : 'يبقى سجله في التقارير، ويمكن التراجع') + '</small></span></button>' +
    '</div>'
  });
}

function toggleMaintenance(deviceId) {
  const d = deviceById(deviceId);
  if (!d || sessionOfDevice(d.id)) return;
  d.maintenance = !d.maintenance;
  if (!d.maintenance && d.note && /صيانة|استبدال|عطل|إصلاح/.test(d.note)) d.note = '';
  persist();
  if (modal) closeModal();
  refresh();
  toast(d.maintenance ? d.name + ' في الصيانة الآن' : d.name + ' عاد للخدمة', { type: d.maintenance ? 'info' : 'ok' });
}

function deleteDevice(deviceId) {
  const d = deviceById(deviceId);
  if (!d || sessionOfDevice(d.id)) return;
  withUndo(function () {
    state.devices = state.devices.filter(function (x) { return x.id !== d.id; });
    state.reservations.forEach(function (r) { if (r.deviceId === d.id && r.status === 'booked') r.status = 'cancelled'; });
    persist();
    closeModal();
    refresh();
  }, 'حُذف ' + d.name + '. سجله باقٍ في التقارير');
}

function moveDevice(deviceId, delta) {
  const i = state.devices.findIndex(function (d) { return d.id === deviceId; });
  const j = i + delta;
  if (i < 0 || j < 0 || j >= state.devices.length) return;
  const tmp = state.devices[i];
  state.devices[i] = state.devices[j];
  state.devices[j] = tmp;
  persist();
  refresh();
}

/* =================== الحجوزات =================== */

function openReservationModal(resvId, preset) {
  preset = preset || {};
  const r = resvId ? resvById(resvId) : null;
  const now = Date.now();
  const defStart = Math.ceil((now + 30 * Billing.MIN) / (15 * Billing.MIN)) * 15 * Billing.MIN;
  const start = r ? r.start : defStart;
  const minutes = r ? r.minutes : 60;
  const deviceId = r ? r.deviceId : (preset.deviceId || (state.devices.find(function (d) { return !d.maintenance; }) || {}).id);
  const presetDur = [30, 60, 90, 120, 180];
  const standard = presetDur.indexOf(minutes) !== -1;
  if (!state.devices.length) { toast('أضف جهازاً أولاً قبل تسجيل الحجوزات', { type: 'warn' }); return; }

  openModal({
    title: r ? 'تعديل الحجز' : 'حجز جديد',
    body:
      '<div class="grid-2">' +
        fieldHtml('f-name', 'اسم الزبون', '<input class="input" id="f-name" autocomplete="off" list="players-list" value="' + esc(r ? r.name : '') + '" autofocus>') +
        fieldHtml('f-phone', 'رقم الهاتف', '<input class="input" id="f-phone" type="tel" dir="ltr" inputmode="tel" value="' + esc(r ? r.phone : '') + '" placeholder="09xx xxx xxx">') +
      '</div>' +
      '<datalist id="players-list">' + recentPlayers().map(function (n) { return '<option value="' + esc(n) + '"></option>'; }).join('') + '</datalist>' +
      '<div class="grid-2">' +
        fieldHtml('f-device', 'الجهاز', '<select class="select input" id="f-device">' + state.types.map(function (t) {
          const ds = state.devices.filter(function (d) { return d.typeId === t.id; });
          if (!ds.length) return '';
          return '<optgroup label="' + esc(t.name) + '">' + ds.map(function (d) {
            return '<option value="' + esc(d.id) + '"' + (d.id === deviceId ? ' selected' : '') + '>' + esc(d.name) + (d.maintenance ? ' (صيانة)' : '') + '</option>';
          }).join('') + '</optgroup>';
        }).join('') + orphanDeviceOptions(deviceId) + '</select>') +
        fieldHtml('f-start', 'الموعد', '<input class="input" id="f-start" type="datetime-local" step="300" value="' + toLocalInput(start) + '">') +
      '</div>' +
      '<div class="stack-sm"><span class="field-label">المدة</span><div class="option-grid cols-3">' +
        presetDur.map(function (m) { return opt('rdur', m, fmtMinutes(m), '', m === minutes); }).join('') + opt('rdur', 'c', 'مخصص', '', !standard) +
      '</div><div id="rcustom-wrap"' + (standard ? ' hidden' : '') + '><div class="input-affix"><input class="input" type="number" min="15" step="15" id="f-rcustom" value="' + minutes + '"><span class="affix">دقيقة</span></div></div></div>' +
      fieldHtml('f-note', 'ملاحظة <span class="faint">(اختياري)</span>', '<input class="input" id="f-note" value="' + esc(r ? r.note : '') + '" placeholder="مثال: بطولة، عيد ميلاد، عدد الأشخاص">') +
      '<div id="resv-info"></div>',
    foot: '<button type="submit" class="btn btn-primary">' + (r ? 'حفظ الحجز' : 'تسجيل الحجز') + '</button><button type="button" class="btn" data-action="modal-close">إلغاء</button>',
    onChange: function () {
      const dur = pickValue('rdur');
      $('#rcustom-wrap').hidden = dur !== 'c';
      const m = dur === 'c' ? Math.max(15, Math.round(mnum('f-rcustom', 60))) : Number(dur);
      const st = fromLocalInput(mval('f-start'));
      const dev = deviceById(mval('f-device'));
      const info = $('#resv-info');
      if (!st || !dev) { info.innerHTML = ''; return; }
      const conflicts = resvConflicts(dev.id, st, m, r ? r.id : null);
      const msgs = [];
      if (conflicts.length) msgs.push('يتعارض مع حجز <b>' + esc(conflicts[0].name) + '</b> من ' + fmtTime(conflicts[0].start) + ' إلى ' + fmtTime(conflicts[0].start + conflicts[0].minutes * Billing.MIN) + '.');
      const s = sessionOfDevice(dev.id);
      if (s && st < now + 3 * 3600000) {
        const rem = Billing.remainingMs(s, now);
        msgs.push('الجهاز مشغول الآن' + (rem != null && rem > 0 ? ' حتى ' + fmtTime(now + rem) : ' بوقت مفتوح') + '.');
      }
      if (dev.maintenance) msgs.push('الجهاز في الصيانة حالياً.');
      if (!r && st < now - 5 * Billing.MIN) msgs.push('الموعد في الماضي.');
      info.innerHTML = msgs.length
        ? '<div class="note-warn">' + icon('alert') + '<span>' + msgs.join(' ') + '</span></div>'
        : '<div class="estimate" style="padding:10px 14px"><span class="muted" style="font-size:13px;font-weight:700">' + relativeDay(st, now) + ' ' + fmtTime(st) + ' — ' + fmtTime(st + m * Billing.MIN) + '</span><span class="tag go">الموعد متاح</span></div>';
    },
    onSubmit: function () {
      const name = mval('f-name').trim();
      const dur = pickValue('rdur');
      const m = dur === 'c' ? Math.max(15, Math.round(mnum('f-rcustom', 60))) : Number(dur);
      const st = fromLocalInput(mval('f-start'));
      const devId = mval('f-device');
      const warn = function (msg) { $('#resv-info').innerHTML = '<div class="note-warn">' + icon('alert') + '<span>' + msg + '</span></div>'; };
      if (!name) { warn('اكتب اسم الزبون.'); $('#f-name').focus(); return; }
      if (!st) { warn('حدّد موعد الحجز.'); return; }
      if (!r && st < now - 5 * Billing.MIN) { warn('لا يمكن تسجيل حجز جديد في وقت مضى.'); return; }
      const conflicts = resvConflicts(devId, st, m, r ? r.id : null);
      if (conflicts.length) { warn('الموعد يتعارض مع حجز ' + esc(conflicts[0].name) + '. اختر وقتاً أو جهازاً آخر.'); return; }
      const rec = r || { id: uid(), status: 'booked', createdAt: now };
      rec.name = name;
      rec.phone = mval('f-phone').trim();
      rec.deviceId = devId;
      rec.start = st;
      rec.minutes = m;
      rec.note = mval('f-note').trim();
      if (!r) state.reservations.push(rec);
      persist();
      closeModal();
      refresh();
      const dev = deviceById(devId);
      toast((r ? 'حُفظ حجز ' : 'سُجّل حجز ') + name + ' — ' + relativeDay(st, now) + ' ' + fmtTime(st) + ' على ' + (dev ? dev.name : ''));
    }
  });
}

function orphanDeviceOptions(selectedId) {
  const known = new Set(state.types.map(function (t) { return t.id; }));
  const ds = state.devices.filter(function (d) { return !known.has(d.typeId); });
  if (!ds.length) return '';
  return '<optgroup label="أخرى">' + ds.map(function (d) {
    return '<option value="' + esc(d.id) + '"' + (d.id === selectedId ? ' selected' : '') + '>' + esc(d.name) + '</option>';
  }).join('') + '</optgroup>';
}

function startReservation(resvId) {
  const r = resvById(resvId);
  if (!r) return;
  const d = deviceById(r.deviceId);
  if (!d) { toast('الجهاز المحجوز لم يعد موجوداً. عدّل الحجز واختر جهازاً آخر.', { type: 'warn' }); return; }
  if (sessionOfDevice(d.id)) { toast(d.name + ' مشغول حالياً. انقل الجلسة الجارية أو انتظر انتهاءها.', { type: 'warn' }); return; }
  openStartModal(d.id, { player: r.name, phone: r.phone, planned: r.minutes, reservationId: r.id });
}

function setResvStatus(resvId, status) {
  const r = resvById(resvId);
  if (!r) return;
  withUndo(function () {
    r.status = status;
    persist();
    refresh();
  }, (status === 'cancelled' ? 'أُلغي حجز ' : 'سُجّل عدم حضور ') + r.name);
}

/* =================== المنتجات والبيع المباشر =================== */

function openProductModal(productId) {
  const p = productId ? productById(productId) : null;
  const tracked = p ? p.stock != null : true;
  openModal({
    title: p ? 'تعديل المنتج' : 'منتج جديد',
    body:
      fieldHtml('f-name', 'اسم المنتج', '<input class="input" id="f-name" autocomplete="off" value="' + esc(p ? p.name : '') + '" placeholder="مثال: بيبسي" autofocus>') +
      '<div class="grid-2">' +
        fieldHtml('f-cat', 'الفئة', '<select class="select input" id="f-cat">' + PRODUCT_CATEGORIES.map(function (c) {
          return '<option value="' + c.id + '"' + (p && p.category === c.id ? ' selected' : '') + '>' + c.name + '</option>';
        }).join('') + '</select>') +
        fieldHtml('f-price', 'السعر', moneyInput('f-price', p ? p.price : '')) +
      '</div>' +
      '<label class="check"><input type="checkbox" id="f-track"' + (tracked ? ' checked' : '') + '> تتبّع المخزون</label>' +
      '<div id="stock-wrap">' + fieldHtml('f-stock', 'الكمية المتوفرة', '<input class="input" type="number" min="0" step="1" id="f-stock" value="' + (p && p.stock != null ? p.stock : 0) + '">', 'تنقص تلقائياً مع كل بيع أو طلب، ويظهر تنبيه عند 5 قطع أو أقل.') + '</div>' +
      '<div id="p-err" class="note-warn" hidden></div>',
    foot: '<button type="submit" class="btn btn-primary">' + (p ? 'حفظ' : 'إضافة المنتج') + '</button>' +
      (p ? '<button type="button" class="btn btn-danger" data-action="product-delete" data-id="' + p.id + '">' + icon('trash', 'ic-sm') + 'حذف</button>' : '') +
      '<button type="button" class="btn" data-action="modal-close">إلغاء</button>',
    onChange: function () { $('#stock-wrap').hidden = !$('#f-track').checked; },
    onSubmit: function () {
      const name = mval('f-name').trim();
      const price = Math.round(mnum('f-price', -1));
      if (!name) { setErrorHtml('p-err', 'اكتب اسم المنتج.'); return; }
      if (price < 0) { setErrorHtml('p-err', 'أدخل سعراً صحيحاً.'); return; }
      const rec = p || { id: uid() };
      rec.name = name;
      rec.category = mval('f-cat');
      rec.price = price;
      rec.stock = $('#f-track').checked ? Math.max(0, Math.round(mnum('f-stock', 0))) : null;
      if (!p) state.products.push(rec);
      persist();
      closeModal();
      refresh();
      toast(p ? 'حُفظ ' + name : 'أُضيف ' + name);
    }
  });
}

function deleteProduct(productId) {
  const p = productById(productId);
  if (!p) return;
  withUndo(function () {
    state.products = state.products.filter(function (x) { return x.id !== p.id; });
    state.cart = state.cart.filter(function (i) { return i.productId !== p.id; });
    persist();
    closeModal();
    refresh();
  }, 'حُذف ' + p.name + ' من القائمة');
}

function cartChange(productId, delta) {
  const p = productById(productId);
  if (delta > 0) {
    if (!p) return;
    if (!takeStock(p, delta)) { toast('نفد مخزون ' + p.name, { type: 'warn' }); return; }
    addLine(state.cart, p, delta);
  } else {
    const line = state.cart.find(function (i) { return i.productId === productId; });
    if (!line) return;
    line.qty += delta;
    returnStock(productId, -delta);
    if (line.qty <= 0) state.cart = state.cart.filter(function (i) { return i !== line; });
  }
  persist();
  renderProducts();
  renderCart();
}

function clearCart() {
  withUndo(function () {
    state.cart.forEach(function (i) { returnStock(i.productId, i.qty); });
    state.cart = [];
    persist();
    renderProducts();
    renderCart();
  }, 'أُفرغت السلة');
}

function openSaleCheckout() {
  if (!state.cart.length) return;
  const subtotal = Billing.itemsTotal(state.cart);
  let paidTouched = false;
  let calc = null;
  openModal({
    title: 'إتمام البيع',
    sub: state.cart.reduce(function (a, i) { return a + i.qty; }, 0) + ' قطعة',
    body:
      '<div class="sum-rows">' + state.cart.map(function (i) {
        return '<div class="sum-row"><span>' + esc(i.name) + ' <span class="faint num">× ' + i.qty + '</span></span><span>' + fmtNum(i.price * i.qty) + '</span></div>';
      }).join('') + '</div>' +
      fieldHtml('f-customer', 'اسم الزبون <span class="faint">(اختياري)</span>', '<input class="input" id="f-customer" list="players-list" autocomplete="off">') +
      '<datalist id="players-list">' + recentPlayers().map(function (n) { return '<option value="' + esc(n) + '"></option>'; }).join('') + '</datalist>' +
      '<div class="grid-2">' +
        fieldHtml('f-discount', 'خصم', moneyInput('f-discount', '', '0')) +
        fieldHtml('f-paid', 'المبلغ المدفوع', moneyInput('f-paid', subtotal)) +
      '</div>' +
      '<div class="quick-cash" id="quick-cash"></div>' +
      '<div class="stack-sm"><span class="field-label">طريقة الدفع</span><div class="seg seg-block" role="group">' +
        '<button type="button" data-pick="pay" data-value="cash" aria-pressed="true">' + icon('banknote', 'ic-sm') + 'نقدي</button>' +
        '<button type="button" data-pick="pay" data-value="card" aria-pressed="false">' + icon('wallet', 'ic-sm') + 'دفع إلكتروني</button>' +
      '</div></div>' +
      '<div class="sum-rows" id="co-sum"></div><div class="note-warn" id="co-err" hidden></div>',
    foot: '<button type="submit" class="btn btn-primary btn-lg">' + icon('check', 'ic-sm') + 'تأكيد البيع</button><button type="button" class="btn btn-lg" data-action="modal-close">رجوع</button>',
    onChange: function (id) {
      if (id === 'f-paid') paidTouched = true;
      const discount = clamp(Math.round(mnum('f-discount', 0)), 0, subtotal);
      const total = subtotal - discount;
      if (!paidTouched) $('#f-paid').value = total;
      const paid = mval('f-paid') === '' ? total : Math.round(mnum('f-paid', total));
      if (!calc || calc.total !== total) $('#quick-cash').innerHTML = quickCashHtml(total);
      calc = { discount: discount, total: total, paid: paid };
      const change = paid - total;
      $('#co-sum').innerHTML =
        (discount ? '<div class="sum-row discount"><span>الخصم</span><span dir="ltr">−' + fmtNum(discount) + '</span></div>' : '') +
        '<div class="sum-row total"><span>الإجمالي</span><span>' + ledMoney(total) + '</span></div>' +
        (change > 0 ? '<div class="sum-row"><span>الباقي للزبون</span><span style="color:var(--go)">' + money(change) + '</span></div>' : '') +
        (change < 0 ? '<div class="sum-row"><span>ناقص</span><span style="color:var(--red)">' + money(-change) + '</span></div>' : '');
      setError('co-err', '');
    },
    onSubmit: function () {
      if (calc.paid < calc.total) {
        $('#co-err').innerHTML = icon('alert') + '<span>المبلغ المدفوع أقل من الإجمالي بـ ' + money(calc.total - calc.paid) + '.</span>';
        $('#co-err').hidden = false;
        return;
      }
      const now = Date.now();
      const rec = {
        id: uid(), no: state.meta.receiptSeq + 1, kind: 'sale', deviceId: null, deviceName: 'بيع مباشر', typeName: '',
        player: mval('f-customer').trim(), phone: '', mode: null, plannedMin: null, startedAt: now, endedAt: now,
        playedMs: 0, billedMinutes: 0, avgRate: 0, timeAmount: 0,
        items: state.cart.map(function (i) { return Object.assign({}, i); }),
        itemsAmount: subtotal, discount: calc.discount, total: calc.total, paid: calc.paid,
        method: pickValue('pay') || 'cash', note: ''
      };
      withUndo(function () {
        state.meta.receiptSeq = rec.no;
        state.history.push(rec);
        state.cart = [];
        persist();
        closeModal();
        refresh();
        beep('ok');
      }, 'تم البيع — ' + money(rec.total), [{ label: 'الإيصال', run: function () { openReceipt(rec.id); } }]);
    }
  });
}

/* =================== الإيصال =================== */

function receiptHtml(r) {
  const st = state.settings;
  let h = '<div class="receipt" id="receipt-paper"><h3>' + esc(st.centerName) + '</h3>' +
    '<div class="r-center r-muted">إيصال رقم <span class="num">#' + r.no + '</span> · ' + fmtDateNumeric(r.endedAt) + ' · ' + fmtTime(r.endedAt) + '</div><hr class="r-sep">';
  if (r.kind === 'session') {
    h += '<div class="r-row"><span>الجهاز</span><span>' + bdi(r.deviceName) + '</span></div>' +
      (r.player ? '<div class="r-row"><span>الزبون</span><span>' + esc(r.player) + '</span></div>' : '') +
      '<div class="r-row"><span>من — إلى</span><span>' + fmtTime(r.startedAt) + ' — ' + fmtTime(r.endedAt) + '</span></div>' +
      '<div class="r-row"><span>مدة اللعب</span><span>' + fmtDur(r.playedMs) + '</span></div>' +
      '<div class="r-row"><span>المحتسب</span><span>' + r.billedMinutes + ' د × ' + fmtNum(r.avgRate) + '/ساعة</span></div>' +
      (r.mode ? '<div class="r-row"><span>النمط</span><span>' + (r.mode === 'multi' ? 'زوجي' : 'فردي') + '</span></div>' : '') +
      '<div class="r-row"><span><b>أجرة الوقت</b></span><span><b>' + fmtNum(r.timeAmount) + '</b></span></div>';
  } else if (r.player) {
    h += '<div class="r-row"><span>الزبون</span><span>' + esc(r.player) + '</span></div>';
  }
  if (r.items.length) {
    h += '<hr class="r-sep">' + r.items.map(function (i) {
      return '<div class="r-row"><span>' + esc(i.name) + ' × ' + i.qty + '</span><span>' + fmtNum(i.price * i.qty) + '</span></div>';
    }).join('');
  }
  h += '<hr class="r-sep">' +
    (r.discount ? '<div class="r-row"><span>الخصم</span><span dir="ltr">−' + fmtNum(r.discount) + '</span></div>' : '') +
    '<div class="r-row r-total"><span>الإجمالي</span><span>' + fmtNum(r.total) + ' ' + esc(st.currency) + '</span></div>' +
    '<div class="r-row"><span>المدفوع (' + (PAY_METHODS[r.method] || 'نقدي') + ')</span><span>' + fmtNum(r.paid) + '</span></div>' +
    (r.paid > r.total ? '<div class="r-row"><span>الباقي</span><span>' + fmtNum(r.paid - r.total) + '</span></div>' : '') +
    (r.note ? '<div class="r-muted">ملاحظة: ' + esc(r.note) + '</div>' : '') +
    '<hr class="r-sep"><div class="r-center r-muted">' + esc(st.receiptFooter) + '</div></div>';
  return h;
}

function receiptText(r) {
  const st = state.settings;
  const L = [st.centerName, 'إيصال #' + r.no + ' — ' + fmtDateNumeric(r.endedAt) + ' ' + fmtTime(r.endedAt), '----------------'];
  if (r.kind === 'session') {
    L.push('الجهاز: ' + r.deviceName);
    if (r.player) L.push('الزبون: ' + r.player);
    L.push('من ' + fmtTime(r.startedAt) + ' إلى ' + fmtTime(r.endedAt) + ' (' + fmtDur(r.playedMs) + ')');
    L.push('أجرة الوقت: ' + fmtNum(r.timeAmount) + ' (' + r.billedMinutes + ' د)');
  }
  r.items.forEach(function (i) { L.push(i.name + ' ×' + i.qty + ': ' + fmtNum(i.price * i.qty)); });
  if (r.discount) L.push('الخصم: −' + fmtNum(r.discount));
  L.push('----------------', 'الإجمالي: ' + fmtNum(r.total) + ' ' + st.currency, st.receiptFooter);
  return L.join('\n');
}

function openReceipt(recId) {
  const r = state.history.find(function (x) { return x.id === recId; });
  if (!r) return;
  openModal({
    title: 'إيصال #' + r.no,
    sub: fmtDate(r.endedAt, true) + ' · ' + fmtTime(r.endedAt),
    body: receiptHtml(r),
    foot: (isFramed() ? '' : '<button type="button" class="btn btn-primary" data-action="receipt-print" data-id="' + r.id + '">' + icon('printer', 'ic-sm') + 'طباعة</button>') +
      '<button type="button" class="btn' + (isFramed() ? ' btn-primary' : '') + '" data-action="receipt-copy" data-id="' + r.id + '">' + icon('copy', 'ic-sm') + 'نسخ كنص</button>' +
      '<button type="button" class="btn" data-action="modal-close">إغلاق</button>'
  });
}

function printReceipt(recId) {
  const r = state.history.find(function (x) { return x.id === recId; });
  if (!r) return;
  $('#print-root').innerHTML = receiptHtml(r);
  try { window.print(); } catch (e) { toast('الطباعة غير متاحة هنا', { type: 'warn' }); }
}

function deleteHistory(recId) {
  const r = state.history.find(function (x) { return x.id === recId; });
  if (!r) return;
  withUndo(function () {
    state.history = state.history.filter(function (x) { return x.id !== r.id; });
    persist();
    closeModal();
    refresh();
  }, 'حُذف الإيصال #' + r.no + ' (' + money(r.total) + ')');
}

/* =================== البيانات =================== */

function exportBackup() {
  offerFile('cyberzone-backup-' + dayKey(Date.now()) + '.json', JSON.stringify(state, null, 1), 'application/json');
}

function importBackup(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function () {
    let data = null;
    try { data = JSON.parse(reader.result); } catch (e) { /* */ }
    if (!isValidBackup(data)) { toast('الملف ليس نسخة احتياطية صالحة من CyberZone', { type: 'danger' }); return; }
    askConfirm({
      title: 'استعادة النسخة الاحتياطية؟',
      message: 'ستُستبدل كل البيانات الحالية بمحتوى الملف: ' + data.devices.length + ' جهاز، ' + data.history.length + ' عملية، ' + (data.reservations || []).length + ' حجز.',
      confirm: 'استعادة',
      danger: true
    }, function () {
      state = normalizeState(data);
      persist();
      applyTheme();
      applyBrand();
      renderNav();
      renderView();
      toast('تمت استعادة النسخة الاحتياطية');
    });
  };
  reader.onerror = function () { toast('تعذّرت قراءة الملف', { type: 'danger' }); };
  reader.readAsText(file);
}

function clearDemo() {
  askConfirm({
    title: 'البدء ببيانات فارغة؟',
    message: 'ستُحذف الجلسات الجارية والحجوزات وسجل العمليات. تبقى الأجهزة والمنتجات والأسعار والإعدادات لتعدّلها حسب صالتك.',
    confirm: 'مسح العمليات',
    danger: true
  }, function () {
    clearOperations(state);
    persist();
    renderView();
    toast('تم المسح. الصالة جاهزة لأول جلسة.');
  });
}

function loadDemo() {
  askConfirm({
    title: 'تحميل البيانات التجريبية؟',
    message: 'ستُستبدل كل بياناتك الحالية ببيانات تجريبية. صدّر نسخة احتياطية أولاً إن كنت تحتاجها.',
    confirm: 'تحميل',
    danger: true
  }, function () {
    const theme = state.settings.theme;
    state = buildDemoState(Date.now());
    state.settings.theme = theme;
    ui.demoHidden = false;
    saveUi();
    persist();
    applyBrand();
    renderView();
    toast('حُمّلت البيانات التجريبية');
  });
}

/* =================== خريطة العمليات =================== */

const ACTIONS = {
  'modal-close': function () { closeModal(); },

  'start-session': function (el) { closeModal(); openStartModal(el.dataset.device); },
  'checkout': function (el) { closeModal(); openCheckout(el.dataset.session); },
  'order': function (el) { closeModal(); openOrder(el.dataset.session); },
  'order-cat': function (el) { orderCat = el.dataset.value; renderOrderBody(); },
  'order-add': function (el) { orderChange(el.dataset.id, 1); },
  'order-inc': function (el) { orderChange(el.dataset.id, 1); },
  'order-dec': function (el) { orderChange(el.dataset.id, -1); },
  'extend': function (el) { closeModal(); openExtend(el.dataset.session); },
  'to-open': function (el) { const s = sessionById(el.dataset.session); if (s) setPlanned(s, null); },
  'pause': function (el) { togglePause(el.dataset.session); },
  'session-menu': function (el) { openSessionMenu(el.dataset.session); },
  'session-edit': function (el) { openSessionEdit(el.dataset.session); },
  'session-transfer': function (el) { openTransfer(el.dataset.session); },
  'transfer-to': function (el) { transferTo(el.dataset.session, el.dataset.device); },
  'session-cancel': function (el) { cancelSession(el.dataset.session); },

  'device-add': function () { openDeviceModal(); },
  'device-edit': function (el) { openDeviceModal(el.dataset.device); },
  'device-menu': function (el) { openDeviceMenu(el.dataset.device); },
  'device-delete': function (el) { deleteDevice(el.dataset.device); },
  'maint-toggle': function (el) { toggleMaintenance(el.dataset.device); },

  'resv-new': function (el) { openReservationModal(null, { deviceId: el.dataset.device }); },
  'resv-edit': function (el) { openReservationModal(el.dataset.id); },
  'resv-start': function (el) { startReservation(el.dataset.id); },
  'resv-cancel': function (el) { setResvStatus(el.dataset.id, 'cancelled'); },
  'resv-noshow': function (el) { setResvStatus(el.dataset.id, 'noshow'); },
  'resv-delete': function (el) {
    const r = resvById(el.dataset.id);
    if (!r) return;
    withUndo(function () {
      state.reservations = state.reservations.filter(function (x) { return x.id !== r.id; });
      persist();
      refresh();
    }, 'حُذف حجز ' + r.name);
  },
  'res-tab': function (el) { ui.resTab = el.dataset.value; saveUi(); renderBookings(); },

  'floor-status': function (el) { ui.floorStatus = el.dataset.value; saveUi(); renderBoard(); renderStations(); },
  'floor-type': function (el) { ui.floorType = el.dataset.value; saveUi(); renderFloorTools(); renderStations(); },
  'floor-view': function (el) { ui.floorView = el.dataset.value; saveUi(); renderFloorTools(); renderStations(); },
  'floor-reset': function () { ui.floorStatus = 'all'; ui.floorType = 'all'; ui.floorSearch = ''; saveUi(); refreshFloor(); },
  'quick-start': function (el) { quickStart(el.dataset.device, Number(el.dataset.min) || 0); },
  'paid-set': function (el) { const f = $('#f-paid'); if (f) { f.value = el.dataset.value; f.dispatchEvent(new Event('input', { bubbles: true })); } },
  'device-up': function (el) { moveDevice(el.dataset.device, -1); },
  'device-down': function (el) { moveDevice(el.dataset.device, 1); },
  'shortcuts': function () { openShortcuts(); },

  'shop-cat': function (el) { ui.shopCat = el.dataset.value; saveUi(); renderShopTools(); renderProducts(); },
  'cart-add': function (el) { cartChange(el.dataset.id, 1); },
  'cart-inc': function (el) { cartChange(el.dataset.id, 1); },
  'cart-dec': function (el) { cartChange(el.dataset.id, -1); },
  'cart-clear': function () { clearCart(); },
  'cart-checkout': function () { openSaleCheckout(); },
  'product-new': function () { openProductModal(); },
  'product-edit': function (el) { openProductModal(el.dataset.id); },
  'product-delete': function (el) { deleteProduct(el.dataset.id); },

  'range': function (el) { ui.range = el.dataset.value; ui.histLimit = 40; saveUi(); renderReports(); },
  'export-csv': function () { exportCsv(); },
  'history-more': function () { ui.histLimit += 60; renderHistoryTable(); },
  'history-delete': function (el) { deleteHistory(el.dataset.id); },
  'receipt': function (el) { openReceipt(el.dataset.id); },
  'receipt-print': function (el) { printReceipt(el.dataset.id); },
  'receipt-copy': function (el) {
    const r = state.history.find(function (x) { return x.id === el.dataset.id; });
    if (r) copyText(receiptText(r));
  },
  'copy-export': function () { const t = $('#f-export'); if (t) copyText(t.value, t); },

  'toggle-theme': function () {
    const th = state.settings.theme;
    const dark = th === 'dark' || (th === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    state.settings.theme = dark ? 'light' : 'dark';
    persist();
    applyTheme();
    if (ui.view === 'settings') renderSettings();
    if (ui.view === 'reports') drawCharts();
  },
  'test-sound': function () { unlockAudio(); beep('over', true); },
  'enable-notify': function () { enableNotifications(); },
  'backup-export': function () { exportBackup(); },
  'backup-import': function () { const f = $('#import-file'); if (f) f.click(); },
  'demo-clear': function () { clearDemo(); },
  'demo-load': function () { loadDemo(); },
  'demo-hide': function () { ui.demoHidden = true; saveUi(); renderBanners(); },
  'type-add': function () { addType(); },
  'type-delete': function (el) { deleteType(el.dataset.id); }
};
