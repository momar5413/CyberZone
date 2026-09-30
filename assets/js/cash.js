/* CyberZone — الصندوق: الورديات، المصاريف والسحوبات، ومطابقة النقد عند الإغلاق */
'use strict';

const MOVE_KINDS = {
  expense: { label: 'مصروف', sign: -1, hint: 'يُخصم من الصندوق ويظهر في التقارير كمصروف' },
  withdraw: { label: 'سحب', sign: -1, hint: 'نقد يُؤخذ من الصندوق (مثلاً لصاحب الصالة)' },
  deposit: { label: 'إيداع', sign: 1, hint: 'نقد يُضاف إلى الصندوق (فكّة مثلاً)' }
};

function lastClosedShift() {
  const closed = state.shifts.filter(function (x) { return x.closedAt; });
  return closed.length ? closed[closed.length - 1] : null;
}

function renderCash() {
  const now = Date.now();
  const sh = openShift();
  setTopbar('الصندوق',
    sh ? 'وردية مفتوحة منذ ' + relativeDay(sh.openedAt, now) + ' ' + fmtTime(sh.openedAt) + ' · ' + fmtDur(now - sh.openedAt)
       : 'لا توجد وردية مفتوحة',
    sh ? '<button class="btn btn-primary" data-action="shift-close">إغلاق الوردية وعدّ الصندوق</button>' : '');

  let main;
  if (sh) {
    const d = shiftDrawer(sh, now);
    main = '<section class="panel">' +
      '<div class="drawer-hero">' +
        '<div><div class="stat-label">المفروض أن يكون في الصندوق الآن</div><div class="drawer-num led">' + fmtNum(d.expected) + '<small>' + esc(cur()) + '</small></div></div>' +
        '<div class="hint" style="text-align:end">' + d.receipts + ' إيصال في هذه الوردية</div>' +
      '</div>' +
      '<div class="info-grid" style="margin-top:14px;grid-template-columns:repeat(3,minmax(0,1fr))">' +
        infoCell2('رصيد الافتتاح', fmtNum(d.opening)) +
        infoCell2('مقبوض نقداً', signed(d.cashSales, 1)) +
        infoCell2('دفع إلكتروني', fmtNum(d.cardSales) + ' <span class="faint" style="font-weight:500;font-size:12px">خارج الصندوق</span>') +
        infoCell2('مصاريف', signed(d.expenses, -1)) +
        infoCell2('سحوبات', signed(d.withdrawals, -1)) +
        infoCell2('إيداعات', signed(d.deposits, 1)) +
      '</div>' +
      '<h2 class="panel-title" style="margin:20px 0 6px">حركة الصندوق في هذه الوردية</h2>' +
      ledgerHtml(sh, now) +
    '</section>';
  } else {
    const last = lastClosedShift();
    main = '<section class="panel"><div class="stack">' +
      '<div><h2 class="panel-title">افتح وردية جديدة</h2><p class="hint" style="margin-top:4px">اكتب المبلغ الموجود في الصندوق الآن. أثناء الوردية يُحسب المتوقع تلقائياً من الإيصالات النقدية والمصاريف، وعند الإغلاق تعدّ النقد وترى الفرق.</p></div>' +
      '<div class="grid-2" style="align-items:end">' +
        fieldHtml('sh-opening', 'رصيد الافتتاح', moneyInput('sh-opening', last ? last.counted : 0), last ? 'المعدود عند إغلاق آخر وردية: ' + money(last.counted) : '') +
        '<button class="btn btn-primary btn-lg" data-action="shift-open">فتح الوردية</button>' +
      '</div></div></section>';
  }

  const aside = '<aside class="side"><section class="panel"><h2 class="panel-title" style="margin-bottom:12px">تسجيل حركة نقدية</h2><div class="stack">' +
    '<div class="seg seg-block" role="group" aria-label="نوع الحركة">' + Object.keys(MOVE_KINDS).map(function (k) {
      return '<button type="button" data-pick="mv-kind" data-value="' + k + '" aria-pressed="' + (ui.mvKind === k) + '">' + MOVE_KINDS[k].label + '</button>';
    }).join('') + '</div>' +
    '<p class="hint" id="mv-hint">' + MOVE_KINDS[ui.mvKind].hint + '</p>' +
    fieldHtml('mv-amount', 'المبلغ', moneyInput('mv-amount', '')) +
    fieldHtml('mv-note', 'البيان', '<input class="input" id="mv-note" autocomplete="off" placeholder="مثال: اشتراك الأمبيرات">') +
    '<div class="presets" id="mv-presets"' + (ui.mvKind === 'expense' ? '' : ' hidden') + '>' + EXPENSE_PRESETS.map(function (x) {
      return '<button type="button" class="chip" data-action="mv-preset" data-value="' + esc(x) + '">' + esc(x) + '</button>';
    }).join('') + '</div>' +
    '<button class="btn btn-primary" data-action="move-add">تسجيل</button>' +
    '<p class="hint" id="mv-err" hidden></p>' +
  '</div></section></aside>';

  $('#view').innerHTML = '<div class="cash"><div class="stack" style="min-width:0">' + main + shiftsHistoryHtml() + '</div>' + aside + '</div>';
}

function signed(n, sign) {
  return n ? '<bdi dir="ltr">' + (sign > 0 ? '+' : '−') + fmtNum(n) + '</bdi>' : '0';
}

function infoCell2(label, value) {
  return '<div class="info-cell"><span>' + label + '</span><b class="num">' + value + '</b></div>';
}

function ledgerHtml(sh, now) {
  const to = sh.closedAt || now + 1;
  const rows = [];
  state.history.forEach(function (r) {
    if (r.endedAt >= sh.openedAt && r.endedAt < to) rows.push({ at: r.endedAt, text: 'إيصال #' + r.no + ' · ' + bdi(r.deviceName) + (r.player ? ' · ' + esc(r.player) : ''), amt: r.total, dir: r.method === 'card' ? 'card' : 'in', id: r.id });
  });
  state.cashMoves.forEach(function (m) {
    if (m.at >= sh.openedAt && m.at < to) rows.push({ at: m.at, text: MOVE_KINDS[m.kind].label + (m.note ? ' · ' + esc(m.note) : ''), amt: m.amount, dir: MOVE_KINDS[m.kind].sign > 0 ? 'in' : 'out', move: m.id });
  });
  rows.sort(function (a, b) { return b.at - a.at; });
  if (!rows.length) return '<p class="now-empty">لا حركة بعد في هذه الوردية.</p>';
  const shown = rows.slice(0, 40);
  return '<div class="ledger">' + shown.map(function (x) {
    return '<div class="ledger-row"><span class="mono">' + fmtTime(x.at) + '</span>' +
      '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + x.text + (x.dir === 'card' ? ' <span class="tag idle">إلكتروني</span>' : '') + '</span>' +
      '<span class="row" style="gap:4px;flex-wrap:nowrap"><span class="ledger-amt ' + (x.dir === 'card' ? '' : x.dir) + '" dir="ltr">' + (x.dir === 'out' ? '−' : x.dir === 'in' ? '+' : '') + fmtNum(x.amt) + '</span>' +
      (x.move ? '<button class="btn btn-ghost btn-icon btn-sm" data-action="move-delete" data-id="' + x.move + '" aria-label="حذف الحركة">' + icon('x', 'ic-sm') + '</button>' : '') + '</span></div>';
  }).join('') + '</div>' + (rows.length > shown.length ? '<p class="hint" style="margin-top:8px">عرض آخر ' + shown.length + ' من ' + rows.length + ' حركة</p>' : '');
}

function shiftsHistoryHtml() {
  const closed = state.shifts.filter(function (x) { return x.closedAt; }).slice().reverse().slice(0, 30);
  if (!closed.length) return '';
  return '<section class="panel"><h2 class="panel-title" style="margin-bottom:10px">الورديات السابقة</h2><div class="table-wrap"><table class="table"><thead><tr>' +
    '<th>اليوم</th><th>من</th><th>إلى</th><th class="n">المتوقع</th><th class="n">المعدود</th><th class="n">الفرق</th><th class="actions"></th></tr></thead><tbody>' +
    closed.map(function (x) {
      const diff = x.counted - x.expected;
      return '<tr><td>' + fmtDate(x.openedAt, true) + '</td><td class="num">' + fmtTime(x.openedAt) + '</td><td class="num">' + fmtTime(x.closedAt) + '</td>' +
        '<td class="n">' + fmtNum(x.expected) + '</td><td class="n">' + fmtNum(x.counted) + '</td>' +
        '<td class="n" dir="ltr" style="color:' + (diff < 0 ? 'var(--red)' : diff > 0 ? 'var(--go)' : 'var(--fg-3)') + '">' + (diff > 0 ? '+' : diff < 0 ? '−' : '') + fmtNum(Math.abs(diff)) + '</td>' +
        '<td class="actions"><button class="btn btn-ghost btn-sm" data-action="shift-report" data-id="' + x.id + '">التقرير</button></td></tr>';
    }).join('') + '</tbody></table></div></section>';
}

/* ---------- العمليات ---------- */

function openShiftNow() {
  if (openShift()) return;
  const opening = Math.max(0, Math.round(num($('#sh-opening') ? $('#sh-opening').value : 0, 0)));
  withUndo(function () {
    state.shifts.push({ id: uid(), openedAt: Date.now(), closedAt: null, opening: opening, expected: null, counted: null, note: '' });
    persist();
    renderShiftChip(Date.now());
    refresh();
  }, 'فُتحت الوردية برصيد ' + money(opening));
}

function openCloseShift() {
  const sh = openShift();
  if (!sh) return;
  const at = Date.now();
  const d = shiftDrawer(sh, at);
  openModal({
    title: 'إغلاق الوردية',
    sub: 'من ' + fmtTime(sh.openedAt) + ' حتى ' + fmtTime(at) + ' · ' + fmtDur(at - sh.openedAt),
    body:
      '<div class="estimate"><div><div class="muted" style="font-size:13px;font-weight:600">المفروض في الصندوق</div><div class="faint" style="font-size:12px">افتتاح ' + fmtNum(d.opening) + ' + نقدي ' + fmtNum(d.cashSales) + ' − مصاريف وسحوبات ' + fmtNum(d.expenses + d.withdrawals) + (d.deposits ? ' + إيداع ' + fmtNum(d.deposits) : '') + '</div></div><b>' + ledMoney(d.expected) + '</b></div>' +
      fieldHtml('f-counted', 'المبلغ المعدود فعلياً', moneyInput('f-counted', ''), 'عُدّ النقد في الصندوق واكتبه هنا') +
      '<div class="sum-rows" id="count-diff"></div>' +
      fieldHtml('f-note', 'ملاحظة <span class="faint">(اختياري)</span>', '<input class="input" id="f-note" autocomplete="off" placeholder="مثال: فكّة ناقصة">'),
    foot: '<button type="submit" class="btn btn-primary btn-lg">إغلاق الوردية</button><button type="button" class="btn btn-lg" data-action="modal-close">رجوع</button>',
    onChange: function () {
      const v = mval('f-counted');
      if (v === '') { $('#count-diff').innerHTML = '<p class="hint">سيظهر الفرق بعد إدخال المبلغ.</p>'; return; }
      const diff = Math.round(mnum('f-counted', 0)) - d.expected;
      $('#count-diff').innerHTML = '<div class="sum-row total ' + (diff < 0 ? 'minus' : diff > 0 ? 'plus' : '') + '"><span>' +
        (diff === 0 ? 'الصندوق مطابق' : diff > 0 ? 'زيادة في الصندوق' : 'نقص في الصندوق') + '</span><span>' + fmtNum(Math.abs(diff)) + '</span></div>';
    },
    onSubmit: function () {
      const v = mval('f-counted');
      if (v === '') { $('#f-counted').focus(); $('#count-diff').innerHTML = '<p class="hint" style="color:var(--red)">اكتب المبلغ المعدود لإغلاق الوردية.</p>'; return; }
      const counted = Math.max(0, Math.round(mnum('f-counted', 0)));
      const note = mval('f-note').trim();
      withUndo(function () {
        sh.closedAt = at;
        sh.expected = d.expected;
        sh.counted = counted;
        sh.note = note;
        persist();
        closeModal();
        renderShiftChip(Date.now());
        refresh();
      }, 'أُغلقت الوردية' + (counted === d.expected ? '، والصندوق مطابق' : '، الفرق ' + (counted > d.expected ? '+' : '−') + fmtNum(Math.abs(counted - d.expected))),
      [{ label: 'التقرير', run: function () { openShiftReport(sh.id); } }]);
    }
  });
}

function addMove() {
  const amount = Math.round(num($('#mv-amount').value, 0));
  const note = $('#mv-note').value.trim();
  const err = $('#mv-err');
  if (!(amount > 0)) { err.textContent = 'اكتب مبلغاً أكبر من صفر.'; err.hidden = false; err.style.color = 'var(--red)'; $('#mv-amount').focus(); return; }
  const kind = ui.mvKind;
  withUndo(function () {
    state.cashMoves.push({ id: uid(), at: Date.now(), kind: kind, amount: amount, note: note });
    persist();
    refresh();
  }, 'سُجّل ' + MOVE_KINDS[kind].label + ' ' + money(amount) + (note ? ' · ' + note : ''));
}

function deleteMove(id) {
  const m = state.cashMoves.find(function (x) { return x.id === id; });
  if (!m) return;
  withUndo(function () {
    state.cashMoves = state.cashMoves.filter(function (x) { return x.id !== id; });
    persist();
    refresh();
  }, 'حُذفت الحركة');
}

function shiftReportHtml(sh) {
  const to = sh.closedAt || Date.now();
  const recs = state.history.filter(function (r) { return r.endedAt >= sh.openedAt && r.endedAt < to; });
  const moves = state.cashMoves.filter(function (m) { return m.at >= sh.openedAt && m.at < to; });
  const d = Billing.drawer(sh.opening, recs, moves);
  const sm = summarize(recs);
  const row = function (a, b) { return '<div class="r-row"><span>' + a + '</span><span>' + b + '</span></div>'; };
  const diff = sh.closedAt ? sh.counted - sh.expected : null;
  return '<div class="receipt"><h3>' + esc(state.settings.centerName) + '</h3>' +
    '<div class="r-center r-muted">تقرير وردية · ' + fmtDateNumeric(sh.openedAt) + '</div>' +
    '<div class="r-center r-muted">' + fmtTime(sh.openedAt) + ' — ' + (sh.closedAt ? fmtTime(sh.closedAt) : 'مفتوحة') + '</div><hr class="r-sep">' +
    row('الجلسات', sm.sessions) + row('ساعات اللعب', (sm.playMs / 3600000).toFixed(1)) + row('مبيعات مباشرة', sm.sales) +
    row('إيراد الوقت', fmtNum(sm.time)) + row('إيراد البوفيه', fmtNum(sm.items)) + (sm.discount ? row('الخصومات', '−' + fmtNum(sm.discount)) : '') +
    '<div class="r-row r-total"><span>إجمالي الإيراد</span><span>' + fmtNum(sm.total) + '</span></div><hr class="r-sep">' +
    row('نقدي', fmtNum(d.cashSales)) + row('إلكتروني', fmtNum(d.cardSales)) + '<hr class="r-sep">' +
    row('رصيد الافتتاح', fmtNum(d.opening)) +
    moves.map(function (m) { return row(MOVE_KINDS[m.kind].label + (m.note ? ': ' + esc(m.note) : ''), (MOVE_KINDS[m.kind].sign > 0 ? '+' : '−') + fmtNum(m.amount)); }).join('') +
    '<div class="r-row r-total"><span>المتوقع في الصندوق</span><span>' + fmtNum(d.expected) + '</span></div>' +
    (sh.closedAt ? row('المعدود', fmtNum(sh.counted)) + '<div class="r-row r-total"><span>الفرق</span><span>' + (diff > 0 ? '+' : diff < 0 ? '−' : '') + fmtNum(Math.abs(diff)) + '</span></div>' : '') +
    (sh.note ? '<div class="r-muted">ملاحظة: ' + esc(sh.note) + '</div>' : '') +
    '</div>';
}

function openShiftReport(id) {
  const sh = state.shifts.find(function (x) { return x.id === id; });
  if (!sh) return;
  openModal({
    title: 'تقرير الوردية',
    sub: fmtDate(sh.openedAt, true),
    body: shiftReportHtml(sh),
    foot: (isFramed() ? '' : '<button type="button" class="btn btn-primary" data-action="shift-print" data-id="' + sh.id + '">' + icon('printer', 'ic-sm') + 'طباعة</button>') +
      '<button type="button" class="btn" data-action="modal-close">إغلاق</button>'
  });
}

/* ---------- الاختصارات ---------- */

function openShortcuts() {
  const rows = [
    ['1 – 6', 'التنقل بين الأقسام بالترتيب'],
    ['/', 'البحث في القسم الحالي'],
    ['Enter', 'تأكيد النافذة المفتوحة'],
    ['Esc', 'إغلاق النافذة'],
    ['?', 'عرض هذه القائمة']
  ];
  openModal({
    title: 'اختصارات لوحة المفاتيح',
    body: '<div class="shortcuts">' + rows.map(function (r) { return '<span class="kbd" dir="ltr">' + r[0] + '</span><span>' + r[1] + '</span>'; }).join('') + '</div>' +
      '<p class="hint">تعمل الاختصارات عندما لا يكون المؤشر داخل حقل كتابة.</p>'
  });
}

// Enter في نموذج الحركة أو رصيد الافتتاح يسجّل مباشرة
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter' || modal) return;
  const id = e.target && e.target.id;
  if (id === 'mv-amount' || id === 'mv-note') { e.preventDefault(); addMove(); }
  else if (id === 'sh-opening') { e.preventDefault(); openShiftNow(); }
});

Object.assign(ACTIONS, {
  'shift-open': function () { openShiftNow(); },
  'shift-close': function () { openCloseShift(); },
  'shift-report': function (el) { openShiftReport(el.dataset.id); },
  'shift-print': function (el) {
    const sh = state.shifts.find(function (x) { return x.id === el.dataset.id; });
    if (!sh) return;
    $('#print-root').innerHTML = shiftReportHtml(sh);
    try { window.print(); } catch (e) { toast('الطباعة غير متاحة هنا', { type: 'warn' }); }
  },
  'move-add': function () { addMove(); },
  'move-delete': function (el) { deleteMove(el.dataset.id); },
  'mv-preset': function (el) { const n = $('#mv-note'); if (n) { n.value = el.dataset.value; $('#mv-amount').focus(); } }
});
