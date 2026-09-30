/* CyberZone — التقارير والسجل والرسوم البيانية */
'use strict';

const RANGES = [
  ['today', 'اليوم'],
  ['yesterday', 'أمس'],
  ['7d', '7 أيام'],
  ['30d', '30 يوماً'],
  ['month', 'هذا الشهر'],
  ['all', 'الكل'],
  ['custom', 'مخصص']
];

const PAY_METHODS = { cash: 'نقدي', card: 'دفع إلكتروني' };

function rangeBounds(now) {
  const t0 = startOfDay(now);
  const end = now + 1;
  switch (ui.range) {
    case 'today': return [t0, end];
    case 'yesterday': return [addDays(t0, -1), t0];
    case '30d': return [addDays(t0, -29), end];
    case 'month': { const d = new Date(now); return [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), end]; }
    case 'all': return [state.history.length ? startOfDay(state.history[0].endedAt) : t0, end];
    case 'custom': {
      const a = parseDayKey(ui.from) || addDays(t0, -6);
      const b = parseDayKey(ui.to) || t0;
      return a <= b ? [a, addDays(b, 1)] : [b, addDays(a, 1)];
    }
    default: return [addDays(t0, -6), end];
  }
}

function rangeRecords(now) {
  const b = rangeBounds(now);
  return state.history.filter(function (r) { return r.endedAt >= b[0] && r.endedAt < b[1]; });
}

function stat(label, value, note, cls) {
  return '<div class="stat' + (cls ? ' ' + cls : '') + '"><div class="stat-label">' + label + '</div><div class="stat-value led">' + value + '</div>' +
    (note ? '<div class="stat-note">' + note + '</div>' : '') + '</div>';
}

function summarize(recs) {
  const s = { total: 0, time: 0, items: 0, discount: 0, sessions: 0, sales: 0, playMs: 0, cash: 0, card: 0 };
  recs.forEach(function (r) {
    s.total += r.total;
    s.time += r.timeAmount;
    s.items += r.itemsAmount;
    s.discount += r.discount;
    if (r.kind === 'session') { s.sessions++; s.playMs += r.playedMs; } else s.sales++;
    if (r.method === 'card') s.card += r.total; else s.cash += r.total;
  });
  return s;
}

function renderReports() {
  const now = Date.now();
  const b = rangeBounds(now);
  const recs = rangeRecords(now);
  const sm = summarize(recs);
  const rangeLabel = ui.range === 'today' || ui.range === 'yesterday'
    ? fmtDate(b[0], true)
    : fmtDate(b[0]) + ' — ' + fmtDate(Math.min(b[1] - 1, now));
  setTopbar('التقارير', rangeLabel,
    '<button class="btn" data-action="export-csv">' + icon('download', 'ic-sm') + 'تصدير CSV</button>');

  const custom = ui.range === 'custom';
  const b0 = dayKey(b[0]);
  const b1 = dayKey(Math.min(b[1] - 1, now));
  let html = '<div class="filters">' +
    '<div class="seg" role="group" aria-label="الفترة">' + RANGES.map(function (r) {
      return '<button type="button" data-action="range" data-value="' + r[0] + '" aria-pressed="' + (ui.range === r[0]) + '">' + r[1] + '</button>';
    }).join('') + '</div>' +
    (custom ? '<div class="date-range"><label class="sr-only" for="range-from">من</label><input class="input" type="date" id="range-from" value="' + esc(ui.from || b0) + '" max="' + dayKey(now) + '">' +
      '<span class="faint">إلى</span><label class="sr-only" for="range-to">إلى</label><input class="input" type="date" id="range-to" value="' + esc(ui.to || b1) + '" max="' + dayKey(now) + '"></div>' : '') +
    '</div>';

  const avgSession = sm.sessions ? sm.playMs / sm.sessions : 0;
  const expenses = state.cashMoves.filter(function (m) { return m.kind === 'expense' && m.at >= b[0] && m.at < b[1]; });
  const expTotal = expenses.reduce(function (acc, m) { return acc + m.amount; }, 0);
  const net = sm.total - expTotal;
  html += '<section class="stats" aria-label="ملخص الفترة">' +
    stat('إجمالي الإيراد', ledMoney(sm.total), recs.length + ' إيصال · نقدي ' + (sm.total ? Math.round(sm.cash / sm.total * 100) : 0) + '%', 'lead') +
    stat('المصاريف', ledMoney(expTotal), expenses.length ? expenses.length + ' بند · من الصندوق' : 'لا مصاريف مسجلة') +
    stat('الصافي', ledMoney(net), 'الإيراد ناقص المصاريف', net < 0 ? 'neg' : '') +
    stat('الخصومات', ledMoney(sm.discount), 'مخصومة من الإيصالات') +
    stat('إيراد الوقت', ledMoney(sm.time), sm.total ? Math.round(sm.time / (sm.time + sm.items || 1) * 100) + '% من المبيعات' : '—') +
    stat('إيراد البوفيه', ledMoney(sm.items), sm.sales + ' بيع مباشر') +
    stat('الجلسات', fmtNum(sm.sessions), 'متوسط الجلسة ' + (avgSession ? fmtDur(avgSession) : '—')) +
    stat('ساعات اللعب', (sm.playMs / 3600000).toFixed(1) + '<small>ساعة</small>', 'متوسط الإيصال ' + fmtNum(recs.length ? sm.total / recs.length : 0)) +
    '</section>';

  if (!recs.length) {
    html += '<div class="panel empty"><b>لا توجد إيصالات في هذه الفترة</b><span>تظهر هنا الإيرادات والرسوم بعد إنهاء أول جلسة أو بيع. جرّب فترة أطول.</span></div>';
    $('#view').innerHTML = html;
    return;
  }

  const spanDays = Math.round((b[1] - b[0]) / DAY_MS);
  const byHour = spanDays <= 1;
  html += '<div class="report-grid">' +
    '<section class="panel span-8"><div class="panel-head"><div><h2 class="panel-title">' + (byHour ? 'الإيراد حسب الساعة' : 'الإيراد اليومي') + '</h2>' +
      '<div class="legend" style="margin-top:6px"><span><i class="l1"></i>الوقت</span><span><i class="l2"></i>البوفيه</span></div></div></div>' +
      '<div class="chart" data-chart="revenue"></div><div id="revenue-table"></div></section>' +
    '<section class="panel span-4"><div class="panel-head"><h2 class="panel-title">الإيراد حسب الجهاز</h2></div><div id="by-device"></div></section>' +
    '<section class="panel span-6"><div class="panel-head"><div><h2 class="panel-title">ساعات الذروة</h2><div class="panel-sub">عدد الجلسات حسب ساعة البدء</div></div></div><div class="chart" data-chart="peak"></div></section>' +
    '<section class="panel span-6"><div class="panel-head"><div><h2 class="panel-title">الأكثر مبيعاً</h2><div class="panel-sub">الكمية المباعة وإيرادها</div></div></div><div id="top-products"></div></section>' +
    '<section class="panel span-6"><div class="panel-head"><h2 class="panel-title">أفضل الزبائن</h2></div><div id="top-customers"></div></section>' +
    '<section class="panel span-6"><div class="panel-head"><h2 class="panel-title">حسب نوع الجهاز</h2></div><div id="by-type"></div></section>' +
    '<section class="panel span-12"><div class="panel-head" style="flex-wrap:wrap"><h2 class="panel-title">سجل الإيصالات</h2>' +
      '<label class="search"><span class="sr-only">بحث في السجل</span>' + icon('search', 'ic-sm') + '<input class="input" id="hist-search" type="search" placeholder="رقم الإيصال، الجهاز أو الزبون" value="' + esc(ui.histSearch) + '" autocomplete="off"></label></div>' +
      '<div id="history-table"></div></section>' +
    '</div>';
  $('#view').innerHTML = html;

  buildRevenueData(recs, b, byHour);
  buildPeakData(recs);
  renderByDevice(recs);
  renderTopProducts(recs);
  renderTopCustomers(recs);
  renderByType(recs);
  renderHistoryTable();
  drawCharts();
}

/* ---------- تجهيز البيانات ---------- */

const chartData = {};

function buildRevenueData(recs, b, byHour) {
  let buckets = [];
  if (byHour) {
    for (let h = 0; h < 24; h++) buckets.push({ key: h, label: String(h), title: fmtDate(b[0], true) + ' · ' + pad2(h) + ':00–' + pad2(h) + ':59', a: 0, b: 0 });
    recs.forEach(function (r) {
      const h = new Date(r.endedAt).getHours();
      buckets[h].a += r.timeAmount;
      buckets[h].b += r.itemsAmount - r.discount;
    });
  } else {
    const days = Math.round((b[1] - b[0]) / DAY_MS);
    const monthly = days > 62;
    const map = new Map();
    if (monthly) {
      const d0 = new Date(b[0]);
      const d1 = new Date(b[1] - 1);
      for (let d = new Date(d0.getFullYear(), d0.getMonth(), 1); d <= d1; d.setMonth(d.getMonth() + 1)) {
        const k = d.getFullYear() + '-' + d.getMonth();
        const x = { key: k, label: String(d.getMonth() + 1), title: MONTHS[d.getMonth()] + ' ' + d.getFullYear(), a: 0, b: 0 };
        map.set(k, x);
        buckets.push(x);
      }
      recs.forEach(function (r) {
        const d = new Date(r.endedAt);
        const x = map.get(d.getFullYear() + '-' + d.getMonth());
        if (x) { x.a += r.timeAmount; x.b += r.itemsAmount - r.discount; }
      });
    } else {
      for (let t = b[0]; t < b[1] && t <= Date.now(); t = addDays(t, 1)) {
        const d = new Date(t);
        const x = { key: dayKey(t), label: d.getDate() + '/' + (d.getMonth() + 1), title: fmtDate(t, true), a: 0, b: 0 };
        map.set(x.key, x);
        buckets.push(x);
      }
      recs.forEach(function (r) {
        const x = map.get(dayKey(r.endedAt));
        if (x) { x.a += r.timeAmount; x.b += r.itemsAmount - r.discount; }
      });
    }
  }
  // الخصم يُطرح من البوفيه أولاً ثم من الوقت حتى لا تظهر قيم سالبة
  buckets.forEach(function (x) { if (x.b < 0) { x.a += x.b; x.b = 0; } x.a = Math.max(0, x.a); });
  chartData.revenue = {
    title: byHour ? 'الإيراد حسب الساعة' : 'الإيراد اليومي',
    labels: buckets.map(function (x) { return x.label; }),
    titles: buckets.map(function (x) { return x.title; }),
    series: [
      { cls: 'm1', key: '--s1', name: 'الوقت', values: buckets.map(function (x) { return x.a; }) },
      { cls: 'm2', key: '--s2', name: 'البوفيه', values: buckets.map(function (x) { return x.b; }) }
    ],
    fmt: money,
    tickFmt: fmtCompact
  };
  const rows = buckets.filter(function (x) { return x.a || x.b; });
  $('#revenue-table').innerHTML = '<details class="data-table"><summary>عرض البيانات كجدول</summary><div class="table-wrap"><table class="table"><thead><tr><th>' + (byHour ? 'الساعة' : 'الفترة') + '</th><th class="n">الوقت</th><th class="n">البوفيه</th><th class="n">الإجمالي</th></tr></thead><tbody>' +
    rows.map(function (x) { return '<tr><td>' + esc(x.title) + '</td><td class="n">' + fmtNum(x.a) + '</td><td class="n">' + fmtNum(x.b) + '</td><td class="n">' + fmtNum(x.a + x.b) + '</td></tr>'; }).join('') +
    '</tbody></table></div></details>';
}

function buildPeakData(recs) {
  const counts = new Array(24).fill(0);
  recs.forEach(function (r) { if (r.kind === 'session') counts[new Date(r.startedAt).getHours()]++; });
  chartData.peak = {
    title: 'ساعات الذروة',
    labels: counts.map(function (_, h) { return String(h); }),
    titles: counts.map(function (_, h) { return 'من ' + pad2(h) + ':00 إلى ' + pad2(h) + ':59'; }),
    series: [{ cls: 'm1', key: '--s1', name: 'جلسة', values: counts }],
    fmt: function (v) { return fmtNum(v); },
    tickFmt: function (v) { return fmtNum(v); },
    labelEvery: 3,
    integer: true,
    height: 190
  };
}

function barList(rows, opts) {
  if (!rows.length) return '<div class="empty"><span>لا بيانات</span></div>';
  const max = Math.max.apply(null, rows.map(function (r) { return r.value; })) || 1;
  return '<div class="bars">' + rows.map(function (r, i) {
    const pct = r.value / max;
    const tipKey = opts.tip ? opts.tip + ':' + i : '';
    if (tipKey) chartTips.set(tipKey, { title: r.label, rows: r.tipRows });
    return '<div class="bar-row"' + (tipKey ? ' data-tip="' + tipKey + '" tabindex="0"' : '') + '>' +
      '<span class="bar-label">' + esc(r.label) + '</span>' +
      '<span class="bar-track"><span class="bar-fill ' + (opts.cls || '') + '" style="width:calc((100% - 76px) * ' + pct.toFixed(4) + ')"></span>' +
      '<span class="bar-value">' + r.display + '</span></span></div>';
  }).join('') + '</div>';
}

function renderByDevice(recs) {
  const map = new Map();
  recs.forEach(function (r) {
    if (r.kind !== 'session') return;
    const k = r.deviceId || r.deviceName;
    const x = map.get(k) || { label: r.deviceName, value: 0, n: 0, ms: 0 };
    x.value += r.total; x.n++; x.ms += r.playedMs;
    map.set(k, x);
  });
  const rows = Array.from(map.values()).sort(function (a, b) { return b.value - a.value; }).slice(0, 10).map(function (x) {
    x.display = fmtCompact(x.value);
    x.tipRows = [{ value: money(x.value), label: 'الإيراد' }, { value: String(x.n), label: 'جلسة' }, { value: fmtDur(x.ms), label: 'لعب' }];
    return x;
  });
  $('#by-device').innerHTML = barList(rows, { cls: '', tip: 'dev' });
}

function renderTopProducts(recs) {
  const map = new Map();
  recs.forEach(function (r) {
    r.items.forEach(function (i) {
      const x = map.get(i.name) || { label: i.name, value: 0, amount: 0 };
      x.value += i.qty; x.amount += i.qty * i.price;
      map.set(i.name, x);
    });
  });
  const rows = Array.from(map.values()).sort(function (a, b) { return b.value - a.value; }).slice(0, 8).map(function (x) {
    x.display = fmtNum(x.value) + ' <span class="faint" style="font-weight:600">· ' + fmtCompact(x.amount) + '</span>';
    x.tipRows = [{ value: fmtNum(x.value), label: 'قطعة' }, { value: money(x.amount), label: 'الإيراد' }];
    return x;
  });
  $('#top-products').innerHTML = barList(rows, { cls: 's2', tip: 'prod' });
}

function renderTopCustomers(recs) {
  const map = new Map();
  recs.forEach(function (r) {
    if (!r.player || r.kind !== 'session') return;
    const x = map.get(r.player) || { name: r.player, visits: 0, ms: 0, spent: 0, last: 0 };
    x.visits++; x.ms += r.playedMs; x.spent += r.total; x.last = Math.max(x.last, r.endedAt);
    map.set(r.player, x);
  });
  const rows = Array.from(map.values()).sort(function (a, b) { return b.spent - a.spent; }).slice(0, 8);
  $('#top-customers').innerHTML = rows.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>الزبون</th><th class="n">الزيارات</th><th class="n">اللعب</th><th class="n">الإنفاق</th><th>آخر زيارة</th></tr></thead><tbody>' +
    rows.map(function (x) {
      return '<tr><td>' + esc(x.name) + '</td><td class="n">' + x.visits + '</td><td class="n">' + fmtDur(x.ms) + '</td><td class="n">' + fmtNum(x.spent) + '</td><td>' + fmtDate(x.last) + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="empty"><span>لا زبائن مسجلون بالاسم</span></div>';
}

function renderByType(recs) {
  const map = new Map();
  recs.forEach(function (r) {
    if (r.kind !== 'session') return;
    const k = r.typeName || 'غير محدد';
    const x = map.get(k) || { name: k, n: 0, ms: 0, total: 0 };
    x.n++; x.ms += r.playedMs; x.total += r.total;
    map.set(k, x);
  });
  const rows = Array.from(map.values()).sort(function (a, b) { return b.total - a.total; });
  const sum = rows.reduce(function (a, x) { return a + x.total; }, 0) || 1;
  $('#by-type').innerHTML = rows.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>النوع</th><th class="n">الجلسات</th><th class="n">الساعات</th><th class="n">الإيراد</th><th class="n">الحصة</th></tr></thead><tbody>' +
    rows.map(function (x) {
      return '<tr><td>' + esc(x.name) + '</td><td class="n">' + x.n + '</td><td class="n">' + (x.ms / 3600000).toFixed(1) + '</td><td class="n">' + fmtNum(x.total) + '</td><td class="n">' + Math.round(x.total / sum * 100) + '%</td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="empty"><span>لا جلسات في الفترة</span></div>';
}

function renderHistoryTable() {
  const box = $('#history-table');
  if (!box) return;
  const q = ui.histSearch.trim().toLowerCase();
  const recs = rangeRecords(Date.now()).filter(function (r) {
    if (!q) return true;
    return (String(r.no) + ' ' + r.deviceName + ' ' + (r.player || '') + ' ' + (r.phone || '')).toLowerCase().indexOf(q) !== -1;
  }).reverse();
  if (!recs.length) {
    box.innerHTML = '<div class="empty"><span>لا عمليات مطابقة</span></div>';
    return;
  }
  const shown = recs.slice(0, ui.histLimit);
  box.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
    '<th>#</th><th>التاريخ</th><th>الجهاز</th><th>الزبون</th><th class="n">مدة اللعب</th><th class="n">الوقت</th><th class="n">البوفيه</th><th class="n">الخصم</th><th class="n">الإجمالي</th><th>الدفع</th><th class="actions"></th>' +
    '</tr></thead><tbody>' + shown.map(function (r) {
      return '<tr><td class="mono">' + r.no + '</td><td>' + fmtDate(r.endedAt) + ' <span class="faint num">' + fmtTime(r.endedAt) + '</span></td>' +
        '<td>' + bdi(r.deviceName) + '</td><td>' + esc(r.player || '—') + '</td>' +
        '<td class="n">' + (r.playedMs ? fmtDur(r.playedMs) : '—') + '</td>' +
        '<td class="n">' + fmtNum(r.timeAmount) + '</td><td class="n">' + fmtNum(r.itemsAmount) + '</td>' +
        '<td class="n">' + (r.discount ? fmtNum(r.discount) : '—') + '</td><td class="n"><b>' + fmtNum(r.total) + '</b></td>' +
        '<td>' + (PAY_METHODS[r.method] || '—') + '</td>' +
        '<td class="actions"><button class="btn btn-ghost btn-icon btn-sm" data-action="receipt" data-id="' + r.id + '" aria-label="عرض الإيصال ' + r.no + '">' + icon('receipt', 'ic-sm') + '</button>' +
        '<button class="btn btn-ghost btn-icon btn-sm" data-action="history-delete" data-id="' + r.id + '" aria-label="حذف العملية ' + r.no + '">' + icon('trash', 'ic-sm') + '</button></td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<div class="row row-between" style="margin-top:12px"><span class="hint">عرض ' + shown.length + ' من ' + recs.length + ' عملية</span>' +
    (recs.length > shown.length ? '<button class="btn btn-sm" data-action="history-more">عرض المزيد</button>' : '') + '</div>';
}

function exportCsv() {
  const recs = rangeRecords(Date.now());
  const head = ['رقم الإيصال', 'التاريخ', 'البداية', 'النهاية', 'النوع', 'الجهاز', 'فئة الجهاز', 'الزبون', 'الهاتف', 'نمط اللعب', 'مدة اللعب (دقيقة)', 'الدقائق المحتسبة', 'أجرة الوقت', 'البوفيه', 'الخصم', 'الإجمالي', 'المدفوع', 'طريقة الدفع', 'الأصناف', 'ملاحظات'];
  const lines = [head.map(csvCell).join(',')];
  recs.forEach(function (r) {
    lines.push([
      r.no, fmtDateNumeric(r.endedAt), r.kind === 'session' ? fmtTime(r.startedAt) : '', fmtTime(r.endedAt),
      r.kind === 'session' ? 'جلسة' : 'بيع مباشر', r.deviceName, r.typeName || '', r.player || '', r.phone || '',
      r.mode === 'multi' ? 'زوجي' : r.mode === 'single' ? 'فردي' : '',
      Math.round(r.playedMs / 60000), r.billedMinutes, r.timeAmount, r.itemsAmount, r.discount, r.total, r.paid,
      PAY_METHODS[r.method] || '', r.items.map(function (i) { return i.name + ' ×' + i.qty; }).join(' + '), r.note || ''
    ].map(csvCell).join(','));
  });
  const b = rangeBounds(Date.now());
  offerFile('cyberzone-' + dayKey(b[0]) + '_' + dayKey(Math.min(b[1] - 1, Date.now())) + '.csv', '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
}

/* ---------- الرسم ---------- */

function niceStep(v) {
  if (v <= 0) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / e;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return n * e;
}

function roundTopRect(x, y, w, h, r) {
  if (h <= 0) return '';
  r = Math.min(r, h, w / 2);
  return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
    'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
}

function drawCharts() {
  $$('[data-chart]').forEach(function (el) {
    const cfg = chartData[el.dataset.chart];
    if (cfg) columnChart(el, el.dataset.chart, cfg);
  });
}

// رسم أعمدة (مكدّسة عند وجود أكثر من سلسلة). الترتيب من اليمين لليسار ليتوافق مع اتجاه القراءة.
function columnChart(el, id, cfg) {
  const W = Math.max(260, Math.floor(el.clientWidth));
  const H = cfg.height || 230;
  const padT = 22, padB = 26, axisW = 44, plotL = 4;
  const plotR = W - axisW;
  const plotH = H - padT - padB;
  const n = cfg.labels.length;
  const totals = cfg.labels.map(function (_, i) { return cfg.series.reduce(function (a, s) { return a + s.values[i]; }, 0); });
  const peak = Math.max.apply(null, totals.concat([0]));
  const step = cfg.integer ? Math.max(1, Math.ceil(niceStep((peak || 1) / 4))) : niceStep((peak || 1) / 4);
  const maxV = step * 4;
  const y = function (v) { return padT + plotH - (v / maxV) * plotH; };
  const band = (plotR - plotL) / n;
  const bw = Math.min(24, Math.max(3, band * 0.62));
  const every = cfg.labelEvery || Math.max(1, Math.ceil(n / Math.max(1, Math.floor((plotR - plotL) / 44))));
  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" style="direction:ltr" role="img" aria-label="' + esc(cfg.title) + '">';

  for (let k = 0; k <= 4; k++) {
    const v = step * k;
    const yy = Math.round(y(v)) + 0.5;
    svg += '<line class="' + (k === 0 ? 'baseline' : 'gridline') + '" x1="' + plotL + '" x2="' + plotR + '" y1="' + yy + '" y2="' + yy + '"/>';
    svg += '<text x="' + (W - 2) + '" y="' + (yy + 4) + '" text-anchor="end">' + esc(cfg.tickFmt(v)) + '</text>';
  }

  let peakIdx = -1;
  totals.forEach(function (t, i) { if (t > 0 && (peakIdx < 0 || t > totals[peakIdx])) peakIdx = i; });

  let hits = '';
  let marks = '';
  let labels = '';
  cfg.labels.forEach(function (lab, i) {
    const cx = plotR - (i + 0.5) * band;
    const tipKey = id + ':' + i;
    const rows = cfg.series.map(function (s) { return { key: s.key, value: cfg.fmt(s.values[i]), label: s.name }; });
    if (cfg.series.length > 1) rows.push({ value: cfg.fmt(totals[i]), label: 'الإجمالي' });
    chartTips.set(tipKey, { title: cfg.titles[i], rows: rows });
    hits += '<rect class="hit" x="' + (cx - band / 2).toFixed(1) + '" y="' + padT + '" width="' + band.toFixed(1) + '" height="' + plotH + '" data-tip="' + tipKey + '" tabindex="0" aria-label="' + esc(cfg.titles[i] + ': ' + cfg.fmt(totals[i])) + '"/>';

    const drawn = cfg.series.map(function (s) { return s.values[i] > 0; });
    const topIdx = drawn.lastIndexOf(true);
    let acc = 0;
    let first = true;
    cfg.series.forEach(function (s, si) {
      const v = s.values[i];
      if (v <= 0) return;
      const y0 = y(acc);
      const y1 = y(acc + v);
      acc += v;
      let h = y0 - y1;
      if (!first) h -= 2; // فاصل 2px بين الأجزاء المكدّسة
      first = false;
      if (h < 1) h = 1;
      marks += '<path class="' + s.cls + '" style="pointer-events:none" d="' + roundTopRect(+(cx - bw / 2).toFixed(1), +y1.toFixed(1), +bw.toFixed(1), +h.toFixed(1), si === topIdx ? 4 : 0) + '"/>';
    });
    if (i === peakIdx) {
      labels += '<text class="val" x="' + cx.toFixed(1) + '" y="' + (y(totals[i]) - 6).toFixed(1) + '" text-anchor="middle">' + esc(cfg.tickFmt(totals[i])) + '</text>';
    }
    if (i % every === 0) {
      labels += '<text x="' + cx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(lab) + '</text>';
    }
  });
  svg += hits + marks + labels + '</svg>';
  el.innerHTML = svg;
}
