/* CyberZone — الإعدادات: الصالة، قواعد الحساب، الأنواع والأسعار، الأجهزة، التنبيهات، البيانات */
'use strict';

function renderSettings() {
  const st = state.settings;
  setTopbar('الإعدادات', 'تُحفظ التغييرات تلقائياً على هذا الجهاز', '');
  const steps = [1, 5, 10, 15, 30, 60];
  const rounds = [[0, 'بدون تقريب'], [50, '50'], [100, '100'], [250, '250'], [500, '500'], [1000, '1,000']];

  const html = '<div class="settings">' +
    // الصالة
    '<section class="panel"><div class="panel-head"><h2 class="panel-title">معلومات الصالة</h2></div><div class="stack">' +
      fieldHtml('s-name', 'اسم الصالة', '<input class="input" id="s-name" data-setting="centerName" value="' + esc(st.centerName) + '" maxlength="40">', 'يظهر في الشريط الجانبي وعلى الإيصالات.') +
      '<div class="grid-2">' +
        fieldHtml('s-cur', 'رمز العملة', '<input class="input" id="s-cur" data-setting="currency" value="' + esc(st.currency) + '" maxlength="8">') +
        fieldHtml('s-hold', 'مهلة انتظار الحجز', '<div class="input-affix"><input class="input" type="number" min="0" max="120" id="s-hold" data-setting="holdMinutes" data-kind="int" value="' + st.holdMinutes + '"><span class="affix">دقيقة</span></div>') +
      '</div>' +
      fieldHtml('s-footer', 'نص أسفل الإيصال', '<input class="input" id="s-footer" data-setting="receiptFooter" value="' + esc(st.receiptFooter) + '" maxlength="80">') +
    '</div></section>' +

    // قواعد الحساب
    '<section class="panel"><div class="panel-head"><h2 class="panel-title">قواعد حساب الوقت</h2></div><div class="stack">' +
      '<div class="stack-sm"><span class="field-label">وحدة الحساب</span><div class="seg" role="group" aria-label="وحدة الحساب">' +
        steps.map(function (s) { return '<button type="button" data-pick="set-step" data-value="' + s + '" aria-pressed="' + (st.step === s) + '">' + (s === 60 ? 'ساعة' : s + ' د') + '</button>'; }).join('') +
      '</div><small class="hint">يُقرَّب وقت اللعب لأعلى إلى هذه الوحدة. مثال: مع 5 د، جلسة 47 د تُحسب 50 د.</small></div>' +
      '<div class="grid-2">' +
        fieldHtml('s-min', 'الحد الأدنى للجلسة', '<div class="input-affix"><input class="input" type="number" min="0" max="240" id="s-min" data-setting="minMinutes" data-kind="int" value="' + st.minMinutes + '"><span class="affix">دقيقة</span></div>') +
        fieldHtml('s-grace', 'فترة السماح', '<div class="input-affix"><input class="input" type="number" min="0" max="10" id="s-grace" data-setting="grace" data-kind="int" value="' + st.grace + '"><span class="affix">دقيقة</span></div>', 'لا تُحتسب وحدة جديدة إن تجاوزها اللاعب بأقل من هذه المدة.') +
      '</div>' +
      '<div class="grid-2">' +
        fieldHtml('s-round', 'تقريب أجرة الوقت إلى', '<select class="select input" id="s-round" data-setting="roundTo" data-kind="int">' + rounds.map(function (r) {
          return '<option value="' + r[0] + '"' + (st.roundTo === r[0] ? ' selected' : '') + '>' + r[1] + '</option>';
        }).join('') + '</select>') +
        '<div class="stack-sm"><span class="field-label">طريقة التقريب</span><div class="seg seg-block" role="group">' +
          '<button type="button" data-pick="set-roundMode" data-value="nearest" aria-pressed="' + (st.roundMode !== 'up') + '">الأقرب</button>' +
          '<button type="button" data-pick="set-roundMode" data-value="up" aria-pressed="' + (st.roundMode === 'up') + '">لأعلى</button>' +
        '</div></div>' +
      '</div>' +
      '<div class="example" id="billing-example"></div>' +
    '</div></section>' +

    // الأنواع والأسعار
    '<section class="panel wide"><div class="panel-head"><div><h2 class="panel-title">أنواع الأجهزة والأسعار</h2><div class="panel-sub">السعر للساعة. اترك سعر الزوجي فارغاً إن لم يكن للنوع لعب جماعي بسعر مختلف.</div></div>' +
      '<button class="btn btn-sm" data-action="type-add">' + icon('plus', 'ic-sm') + 'نوع جديد</button></div>' +
      '<div class="type-rows" id="type-rows"></div></section>' +

    // الأجهزة
    '<section class="panel wide"><div class="panel-head"><h2 class="panel-title">الأجهزة <span class="faint num" style="font-weight:600">(' + state.devices.length + ')</span></h2>' +
      '<div class="row" style="gap:6px"><button class="btn btn-sm" data-action="setup-open">تجهيز الصالة دفعة واحدة</button><button class="btn btn-sm btn-primary" data-action="device-add">إضافة جهاز</button></div></div>' +
      '<p class="hint" style="margin:-4px 0 10px">رتّب الأجهزة كما هي في الصالة؛ بهذا الترتيب تظهر البطاقات.</p>' +
      devicesTable() + '</section>' +

    // التنبيهات والمظهر
    '<section class="panel"><div class="panel-head"><h2 class="panel-title">التنبيهات</h2></div><div class="stack">' +
      fieldHtml('s-warn', 'التنبيه قبل انتهاء الوقت بـ', '<div class="input-affix"><input class="input" type="number" min="0" max="60" id="s-warn" data-setting="warnMinutes" data-kind="int" value="' + st.warnMinutes + '"><span class="affix">دقيقة</span></div>') +
      '<div class="switch"><label class="check" for="s-sound"><input type="checkbox" id="s-sound" data-setting="sound" data-kind="bool"' + (st.sound ? ' checked' : '') + '> تنبيه صوتي عند اقتراب وانتهاء الوقت</label>' +
        '<button type="button" class="btn btn-sm" data-action="test-sound">' + icon('volume', 'ic-sm') + 'تجربة</button></div>' +
      '<div class="switch"><span class="hint">إشعارات النظام تظهر حتى لو كانت الصفحة في الخلفية.</span>' +
        '<button type="button" class="btn btn-sm" data-action="enable-notify">' + icon('bell', 'ic-sm') + notifyLabel() + '</button></div>' +
    '</div></section>' +

    '<section class="panel"><div class="panel-head"><h2 class="panel-title">المظهر</h2></div><div class="stack">' +
      '<div class="seg seg-block" role="group" aria-label="السمة">' +
        '<button type="button" data-pick="set-theme" data-value="dark" aria-pressed="' + (st.theme === 'dark') + '">' + icon('moon', 'ic-sm') + 'داكن</button>' +
        '<button type="button" data-pick="set-theme" data-value="light" aria-pressed="' + (st.theme === 'light') + '">' + icon('sun', 'ic-sm') + 'فاتح</button>' +
        '<button type="button" data-pick="set-theme" data-value="auto" aria-pressed="' + (st.theme === 'auto') + '">حسب النظام</button>' +
      '</div>' +
      '<p class="hint">نصيحة: ثبّت التطبيق على شاشة الجهاز الرئيسية من قائمة المتصفح ليعمل كتطبيق مستقل وحتى دون إنترنت.</p>' +
    '</div></section>' +

    // البيانات
    '<section class="panel wide"><div class="panel-head"><div><h2 class="panel-title">البيانات والنسخ الاحتياطي</h2>' +
      '<div class="panel-sub">البيانات محفوظة في هذا المتصفح فقط (' + storageSize() + '). صدّر نسخة احتياطية بانتظام لنقلها أو حمايتها.</div></div></div>' +
      '<div class="row">' +
        '<button class="btn" data-action="backup-export">' + icon('download', 'ic-sm') + 'تصدير نسخة احتياطية</button>' +
        '<button class="btn" data-action="backup-import">' + icon('upload', 'ic-sm') + 'استعادة من ملف</button>' +
        '<input type="file" id="import-file" accept="application/json,.json" hidden>' +
        '<span style="flex:1"></span>' +
        '<button class="btn btn-ghost" data-action="demo-load">تحميل بيانات تجريبية</button>' +
        '<button class="btn btn-danger" data-action="demo-clear">مسح العمليات</button>' +
      '</div>' +
      '<p class="hint" style="margin-top:12px">' + state.devices.length + ' جهاز · ' + state.products.length + ' منتج · ' + state.history.length + ' عملية · ' + state.reservations.length + ' حجز · ' + state.sessions.length + ' جلسة جارية</p>' +
    '</section>' +
  '</div>';

  $('#view').innerHTML = html;
  renderTypeRows();
  renderBillingExample();
}

function devicesTable() {
  if (!state.devices.length) return '<div class="empty">' + icon('monitor') + '<span>لا أجهزة بعد.</span></div>';
  const now = Date.now();
  return '<div class="table-wrap"><table class="table"><thead><tr><th>الترتيب</th><th>الجهاز</th><th>النوع</th><th class="n">فردي/ساعة</th><th class="n">زوجي/ساعة</th><th>الحالة</th><th class="actions"></th></tr></thead><tbody>' +
    state.devices.map(function (d, i) {
      const t = typeOf(d);
      const p = devicePhase(d, now);
      const lab = PHASE_LABEL[p];
      return '<tr><td><span class="order-btns">' +
        '<button class="btn btn-ghost btn-icon btn-sm" data-action="device-up" data-device="' + esc(d.id) + '" aria-label="تقديم ' + esc(d.name) + '"' + (i === 0 ? ' disabled' : '') + '>' + icon('chevronUp', 'ic-sm') + '</button>' +
        '<button class="btn btn-ghost btn-icon btn-sm" data-action="device-down" data-device="' + esc(d.id) + '" aria-label="تأخير ' + esc(d.name) + '"' + (i === state.devices.length - 1 ? ' disabled' : '') + '>' + icon('chevronDown', 'ic-sm') + '</button></span></td>' +
        '<td><b>' + bdi(d.name) + '</b>' + (d.note ? '<div class="faint" style="font-size:12px">' + esc(d.note) + '</div>' : '') + '</td>' +
        '<td>' + esc(t.name) + '</td>' +
        '<td class="n">' + fmtNum(rateOf(d, 'single')) + (d.rate ? ' <span class="tag brand">خاص</span>' : '') + '</td>' +
        '<td class="n">' + (hasMulti(d) ? fmtNum(rateOf(d, 'multi')) + (d.rateMulti ? ' <span class="tag brand">خاص</span>' : '') : '—') + '</td>' +
        '<td><span class="tag ' + lab[1] + '">' + lab[0] + '</span></td>' +
        '<td class="actions"><button class="btn btn-ghost btn-icon btn-sm" data-action="device-edit" data-device="' + esc(d.id) + '" aria-label="تعديل ' + esc(d.name) + '">' + icon('pencil', 'ic-sm') + '</button>' +
        '<button class="btn btn-ghost btn-icon btn-sm" data-action="device-delete" data-device="' + esc(d.id) + '" aria-label="حذف ' + esc(d.name) + '"' + (sessionOfDevice(d.id) ? ' disabled' : '') + '>' + icon('trash', 'ic-sm') + '</button></td></tr>';
    }).join('') + '</tbody></table></div>';
}

function renderTypeRows() {
  const box = $('#type-rows');
  if (!box) return;
  box.innerHTML = state.types.map(function (t) {
    const used = state.devices.filter(function (d) { return d.typeId === t.id; }).length;
    return '<div class="type-row">' +
      fieldHtml('t-name-' + t.id, 'الاسم', '<input class="input" id="t-name-' + esc(t.id) + '" data-type-field="name" data-type-id="' + esc(t.id) + '" value="' + esc(t.name) + '">') +
      fieldHtml('t-rate-' + t.id, 'فردي', moneyInputAttr('t-rate-' + t.id, t.rate, 'data-type-field="rate" data-type-id="' + esc(t.id) + '"')) +
      fieldHtml('t-multi-' + t.id, 'زوجي', moneyInputAttr('t-multi-' + t.id, t.rateMulti || '', 'data-type-field="rateMulti" data-type-id="' + esc(t.id) + '" placeholder="—"')) +
      '<button class="btn btn-ghost btn-icon" data-action="type-delete" data-id="' + esc(t.id) + '" aria-label="حذف ' + esc(t.name) + '" title="' + (used ? 'مستخدم في ' + used + ' جهاز' : 'حذف النوع') + '"' + (used ? ' disabled' : '') + '>' + icon('trash', 'ic-sm') + '</button>' +
    '</div>';
  }).join('');
}

function moneyInputAttr(id, value, attrs) {
  return '<div class="input-affix"><input class="input" type="number" inputmode="numeric" min="0" step="any" id="' + esc(id) + '" value="' + esc(value) + '" ' + attrs + '><span class="affix">' + esc(cur()) + '</span></div>';
}

function renderBillingExample() {
  const box = $('#billing-example');
  if (!box) return;
  const t = state.types.find(function (x) { return x.rate; }) || { name: 'جهاز', rate: 20000 };
  const now = Date.now();
  const samples = [7, 47, 62];
  box.innerHTML = '<b>أمثلة على ' + esc(t.name) + ' (' + money(t.rate) + '/ساعة):</b><div class="sum-rows" style="margin-top:8px">' + samples.map(function (m) {
    const c = Billing.timeCharge({ rate: t.rate, segments: [{ rate: t.rate, ms: m * Billing.MIN }], runSince: null, plannedMin: null }, now, state.settings);
    return '<div class="sum-row"><span>لعب ' + m + ' د ← يُحسب ' + c.minutes + ' د</span><span>' + money(c.amount) + '</span></div>';
  }).join('') + '</div>';
}

function storageSize() {
  try {
    const kb = (JSON.stringify(state).length * 2) / 1024;
    return kb > 1024 ? (kb / 1024).toFixed(1) + ' MB' : Math.round(kb) + ' KB';
  } catch (e) { return '—'; }
}

function notifyLabel() {
  if (!('Notification' in window)) return 'غير مدعومة';
  if (state.settings.notify && Notification.permission === 'granted') return 'مفعّلة';
  if (Notification.permission === 'denied') return 'محظورة من المتصفح';
  return 'تفعيل الإشعارات';
}

function enableNotifications() {
  if (!('Notification' in window)) { toast('المتصفح لا يدعم الإشعارات', { type: 'warn' }); return; }
  if (state.settings.notify && Notification.permission === 'granted') {
    state.settings.notify = false;
    persist();
    renderSettings();
    toast('أُوقفت إشعارات النظام', { type: 'info' });
    return;
  }
  try {
    Promise.resolve(Notification.requestPermission()).then(function (p) {
      state.settings.notify = p === 'granted';
      persist();
      if (ui.view === 'settings') renderSettings();
      toast(p === 'granted' ? 'فُعّلت إشعارات النظام' : 'لم يُسمح بالإشعارات. يمكنك تفعيلها من إعدادات المتصفح.', { type: p === 'granted' ? 'ok' : 'warn' });
    }, function () { toast('تعذّر طلب إذن الإشعارات هنا', { type: 'warn' }); });
  } catch (e) { toast('تعذّر طلب إذن الإشعارات هنا', { type: 'warn' }); }
}

function updateSetting(input) {
  const key = input.dataset.setting;
  const kind = input.dataset.kind;
  let v;
  if (kind === 'bool') v = input.checked;
  else if (kind === 'int') {
    v = Math.round(num(input.value, NaN));
    const min = input.hasAttribute('min') ? Number(input.getAttribute('min')) : -Infinity;
    const max = input.hasAttribute('max') ? Number(input.getAttribute('max')) : Infinity;
    if (!Number.isFinite(v)) { input.value = state.settings[key]; return; }
    v = clamp(v, min, max);
    input.value = v;
  } else {
    v = input.value.trim();
    if (!v && (key === 'centerName' || key === 'currency')) { input.value = state.settings[key]; return; }
  }
  state.settings[key] = v;
  persist();
  if (key === 'centerName') applyBrand();
  if (key === 'currency') renderSettings();
  if (['step', 'grace', 'minMinutes', 'roundTo', 'roundMode'].indexOf(key) !== -1) renderBillingExample();
  if (key === 'warnMinutes') {
    const now = Date.now();
    state.sessions.forEach(function (s) {
      const rem = Billing.remainingMs(s, now);
      if (rem != null && rem > v * Billing.MIN) s.warned = false;
    });
    persist();
  }
  toast('حُفظ الإعداد', { timeout: 1500 });
}

function updateTypeField(input) {
  const t = state.types.find(function (x) { return x.id === input.dataset.typeId; });
  if (!t) return;
  const f = input.dataset.typeField;
  if (f === 'name') {
    const v = input.value.trim();
    if (!v) { input.value = t.name; return; }
    t.name = v;
  } else if (f === 'rate') {
    const v = Math.round(num(input.value, NaN));
    if (!Number.isFinite(v) || v < 0) { input.value = t.rate; return; }
    t.rate = v;
  } else if (f === 'rateMulti') {
    const v = Math.round(num(input.value, 0));
    t.rateMulti = v > 0 ? v : null;
    if (!t.rateMulti) input.value = '';
  }
  persist();
  renderBillingExample();
  toast('حُفظ سعر ' + t.name, { timeout: 1500 });
}

function onViewPick(group, value) {
  if (group === 'mv-kind') {
    ui.mvKind = value;
    const h = $('#mv-hint'); if (h) h.textContent = MOVE_KINDS[value].hint;
    const pr = $('#mv-presets'); if (pr) pr.hidden = value !== 'expense';
    return;
  }
  if (group === 'set-step') { state.settings.step = Number(value); persist(); renderBillingExample(); }
  else if (group === 'set-roundMode') { state.settings.roundMode = value; persist(); renderBillingExample(); }
  else if (group === 'set-theme') { state.settings.theme = value; persist(); applyTheme(); }
}

function addType() {
  let n = 1;
  while (state.types.some(function (t) { return t.id === 'type-' + n; })) n++;
  state.types.push({ id: 'type-' + n, name: 'نوع جديد ' + n, icon: 'gamepad', rate: 10000, rateMulti: null });
  persist();
  renderTypeRows();
  const inp = document.getElementById('t-name-type-' + n);
  if (inp) { inp.focus(); inp.select(); }
}

function deleteType(typeId) {
  const t = state.types.find(function (x) { return x.id === typeId; });
  if (!t) return;
  if (state.devices.some(function (d) { return d.typeId === typeId; })) { toast('لا يمكن حذف نوع مستخدم في أجهزة', { type: 'warn' }); return; }
  withUndo(function () {
    state.types = state.types.filter(function (x) { return x.id !== typeId; });
    persist();
    renderSettings();
  }, 'حُذف النوع ' + t.name);
}

/* ---------- تجهيز الصالة (معالج سريع) ---------- */

function openSetup() {
  const counts = {};
  state.types.forEach(function (t) { counts[t.id] = state.devices.filter(function (d) { return d.typeId === t.id; }).length; });
  openModal({
    title: 'تجهيز صالتك',
    sub: 'أدخل عدد الأجهزة من كل نوع وسعر الساعة. يمكنك تعديل كل شيء لاحقاً من الإعدادات.',
    wide: true,
    body:
      '<div class="grid-2">' +
        fieldHtml('w-name', 'اسم الصالة', '<input class="input" id="w-name" maxlength="40" value="' + esc(state.settings.centerName) + '">') +
        fieldHtml('w-cur', 'رمز العملة', '<input class="input" id="w-cur" maxlength="8" value="' + esc(state.settings.currency) + '">') +
      '</div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>النوع</th><th class="n">العدد</th><th class="n">فردي / ساعة</th><th class="n">زوجي / ساعة</th></tr></thead><tbody>' +
      state.types.map(function (t) {
        return '<tr><td><b>' + esc(t.name) + '</b></td>' +
          '<td class="n"><input class="input" style="width:72px;min-height:36px" type="number" min="0" max="60" id="w-n-' + esc(t.id) + '" value="' + counts[t.id] + '"></td>' +
          '<td class="n"><input class="input" style="width:112px;min-height:36px" type="number" min="0" id="w-r-' + esc(t.id) + '" value="' + t.rate + '"></td>' +
          '<td class="n"><input class="input" style="width:112px;min-height:36px" type="number" min="0" id="w-m-' + esc(t.id) + '" value="' + (t.rateMulti || '') + '" placeholder="—"></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<label class="check"><input type="checkbox" id="w-products" checked> إبقاء قائمة منتجات البوفيه الحالية</label>' +
      '<div class="note-warn">' + icon('alert') + '<span>ستُستبدل الأجهزة الحالية، وتُحذف الجلسات والحجوزات والإيصالات والورديات. صدّر نسخة احتياطية أولاً إن كانت لديك بيانات حقيقية.</span></div>' +
      '<p class="hint" id="w-total"></p>',
    foot: '<button type="submit" class="btn btn-primary btn-lg">تجهيز الصالة</button><button type="button" class="btn btn-lg" data-action="modal-close">إلغاء</button>',
    onChange: function () {
      const total = state.types.reduce(function (a, t) { return a + Math.max(0, Math.round(mnum('w-n-' + t.id, 0))); }, 0);
      $('#w-total').textContent = total ? 'سيُنشأ ' + total + ' جهاز بأسماء مثل «' + suggestPrefix(state.types.find(function (t) { return mnum('w-n-' + t.id, 0) > 0; })) + ' · 1».' : 'حدّد جهازاً واحداً على الأقل.';
    },
    onSubmit: function () {
      const total = state.types.reduce(function (a, t) { return a + Math.max(0, Math.round(mnum('w-n-' + t.id, 0))); }, 0);
      if (!total) { $('#w-total').style.color = 'var(--red)'; return; }
      const name = mval('w-name').trim() || 'CyberZone';
      const currency = mval('w-cur').trim() || 'ل.س';
      const keepProducts = $('#w-products').checked;
      const devices = [];
      state.types.forEach(function (t) {
        const n = clamp(Math.round(mnum('w-n-' + t.id, 0)), 0, 60);
        const r = Math.round(mnum('w-r-' + t.id, t.rate));
        const m = Math.round(mnum('w-m-' + t.id, 0));
        t.rate = r > 0 ? r : t.rate;
        t.rateMulti = m > 0 ? m : null;
        for (let i = 1; i <= n; i++) devices.push({ id: uid() + t.id + i, name: suggestPrefix(t) + ' · ' + i, typeId: t.id, rate: null, rateMulti: null, maintenance: false, note: '' });
      });
      clearOperations(state);
      state.devices = devices;
      state.settings.centerName = name;
      state.settings.currency = currency;
      if (!keepProducts) state.products = [];
      ui.floorStatus = 'all';
      ui.floorType = 'all';
      saveUi();
      persist();
      closeModal();
      applyBrand();
      renderShiftChip(Date.now());
      go('floor');
      renderView();
      toast('جُهّزت الصالة: ' + devices.length + ' جهاز. افتح وردية من «الصندوق» عند بدء العمل.');
    }
  });
}

function suggestPrefix(t) {
  if (!t) return 'جهاز';
  return { ps5: 'PS5', ps4: 'PS4', xbox: 'Xbox', pc: 'PC', vr: 'VR' }[t.id] || t.name;
}

ACTIONS['setup-open'] = function () { closeModal(); openSetup(); };
