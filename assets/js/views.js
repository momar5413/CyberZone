/* CyberZone — الشاشات: الصالة، الحجوزات، البوفيه */
'use strict';

/* =================== الصالة =================== */

function renderFloor() {
  const now = Date.now();
  setTopbar('الصالة', fmtDate(now, true) + ' · <span class="hud">' + fmtTime(now) + '</span>',
    '<button class="btn" data-action="resv-new">' + icon('calendarPlus', 'ic-sm') + 'حجز جديد</button>' +
    '<button class="btn btn-primary" data-action="device-add">' + icon('plus', 'ic-sm') + 'إضافة جهاز</button>');
  $('#view').innerHTML =
    '<section class="kpis" id="kpis" aria-label="ملخص اليوم"></section>' +
    '<div class="floor">' +
      '<section aria-label="الأجهزة" style="min-width:0">' +
        '<div class="floor-tools" id="floor-tools"></div>' +
        '<div class="type-chips" id="type-chips"></div>' +
        '<div class="stations" id="stations"></div>' +
      '</section>' +
      '<aside class="side" id="side" aria-label="تنبيهات وحجوزات"></aside>' +
    '</div>';
  refreshFloor();
}

function refreshFloor() {
  if (!$('#stations')) return;
  renderKpis();
  renderFloorTools();
  renderStations();
  renderSide();
}

function todayRecords(now) {
  const t0 = startOfDay(now);
  return state.history.filter(function (r) { return r.endedAt >= t0; });
}

function renderKpis() {
  const now = Date.now();
  const recs = todayRecords(now);
  const revenue = recs.reduce(function (a, r) { return a + r.total; }, 0);
  const sessionsToday = recs.filter(function (r) { return r.kind === 'session'; }).length;
  const active = state.sessions.length;
  const usable = state.devices.filter(function (d) { return !d.maintenance; }).length;
  const t0 = startOfDay(now);
  const t1 = addDays(t0, 1);
  const bookingsToday = state.reservations.filter(function (r) { return r.status === 'booked' && r.start >= t0 && r.start < t1; }).length;
  $('#kpis').innerHTML =
    kpi('wallet', 'إيراد اليوم', moneyHtml(revenue), sessionsToday + ' جلسة منتهية' + (recs.length > sessionsToday ? ' · ' + (recs.length - sessionsToday) + ' بيع مباشر' : '')) +
    kpi('hourglass', 'قيد التحصيل الآن', '<span class="num" data-live="pending">' + fmtNum(pendingTotal(now)) + '</span> <small>' + esc(cur()) + '</small>', 'مجموع حساب الجلسات الجارية') +
    kpi('gamepad', 'الأجهزة المشغولة', '<span class="num">' + active + '</span> <small>من ' + usable + '</small>', (usable - active) + ' متاح الآن') +
    kpi('calendar', 'حجوزات اليوم', '<span class="num">' + bookingsToday + '</span>', bookingsToday ? 'بانتظار الوصول' : 'لا حجوزات متبقية');
}

function kpi(ic, label, value, note) {
  return '<div class="kpi"><div class="kpi-label">' + icon(ic) + label + '</div><div class="kpi-value">' + value + '</div>' +
    (note ? '<div class="kpi-note">' + note + '</div>' : '') + '</div>';
}

function floorCounts(now) {
  const c = { all: 0, free: 0, busy: 0, alert: 0, maint: 0 };
  state.devices.forEach(function (d) {
    const p = devicePhase(d, now);
    c.all++;
    if (p === 'free') c.free++;
    else if (p === 'maint') c.maint++;
    else {
      c.busy++;
      if (p === 'warn' || p === 'over') c.alert++;
    }
  });
  return c;
}

function renderFloorTools() {
  const c = floorCounts(Date.now());
  const opts = [['all', 'الكل'], ['free', 'متاح'], ['busy', 'مشغول'], ['alert', 'ينتهي/انتهى'], ['maint', 'صيانة']];
  $('#floor-tools').innerHTML =
    '<div class="seg" role="group" aria-label="تصفية حسب الحالة">' + opts.map(function (o) {
      return '<button type="button" data-action="floor-status" data-value="' + o[0] + '" aria-pressed="' + (ui.floorStatus === o[0]) + '">' + o[1] + ' <span class="count num">' + c[o[0]] + '</span></button>';
    }).join('') + '</div>' +
    '<label class="search"><span class="sr-only">بحث</span>' + icon('search', 'ic-sm') +
    '<input class="input" id="floor-search" type="search" placeholder="ابحث باسم الجهاز أو اللاعب" value="' + esc(ui.floorSearch) + '" autocomplete="off"></label>';
  const usedTypes = state.types.filter(function (t) { return state.devices.some(function (d) { return d.typeId === t.id; }); });
  $('#type-chips').innerHTML = usedTypes.length > 1
    ? '<button type="button" class="chip" data-action="floor-type" data-value="all" aria-pressed="' + (ui.floorType === 'all') + '">كل الأنواع</button>' +
      usedTypes.map(function (t) {
        return '<button type="button" class="chip" data-action="floor-type" data-value="' + esc(t.id) + '" aria-pressed="' + (ui.floorType === t.id) + '">' + icon(t.icon || 'monitor', 'ic-sm') + esc(t.name) + '</button>';
      }).join('')
    : '';
}

function renderStations() {
  const box = $('#stations');
  if (!box) return;
  const now = Date.now();
  const q = ui.floorSearch.trim().toLowerCase();
  const list = state.devices.filter(function (d) {
    const p = devicePhase(d, now);
    if (ui.floorType !== 'all' && d.typeId !== ui.floorType) return false;
    if (ui.floorStatus === 'free' && p !== 'free') return false;
    if (ui.floorStatus === 'busy' && (p === 'free' || p === 'maint')) return false;
    if (ui.floorStatus === 'alert' && p !== 'warn' && p !== 'over') return false;
    if (ui.floorStatus === 'maint' && p !== 'maint') return false;
    if (q) {
      const s = sessionOfDevice(d.id);
      const hay = (d.name + ' ' + typeOf(d).name + ' ' + (s ? s.player : '')).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });
  if (!state.devices.length) {
    box.innerHTML = '<div class="panel empty" style="grid-column:1/-1">' + icon('monitor') +
      '<b style="color:var(--fg)">لا توجد أجهزة بعد</b><span>أضف أجهزة الصالة (بلايستيشن، كمبيوتر، VR…) لتبدأ بتسجيل الجلسات.</span>' +
      '<button class="btn btn-primary" data-action="device-add">' + icon('plus', 'ic-sm') + 'إضافة أول جهاز</button></div>';
    return;
  }
  if (!list.length) {
    box.innerHTML = '<div class="panel empty" style="grid-column:1/-1">' + icon('search') + '<span>لا توجد أجهزة تطابق التصفية الحالية.</span>' +
      '<button class="btn btn-sm" data-action="floor-reset">عرض كل الأجهزة</button></div>';
    return;
  }
  box.innerHTML = list.map(function (d) { return stationCard(d, now); }).join('');
}

function stationCard(d, now) {
  const t = typeOf(d);
  const s = sessionOfDevice(d.id);
  const phase = devicePhase(d, now);
  const lab = PHASE_LABEL[phase];
  let html = '<article class="station" data-phase="' + phase + '" data-device="' + esc(d.id) + '">' +
    '<div class="station-head">' +
      '<div class="station-icon">' + icon(phase === 'maint' ? 'wrench' : (t.icon || 'monitor'), 'ic-lg') + '</div>' +
      '<div style="min-width:0"><h3 class="station-name">' + bdi(d.name) + '</h3><div class="station-type">' + esc(t.name) + '</div></div>' +
      '<span class="pill ' + lab[1] + '">' + lab[0] + '</span>' +
    '</div>';

  if (s) {
    const tot = sessionTotals(s, now);
    const rem = Billing.remainingMs(s, now);
    const label = phase === 'paused' ? 'متوقف — الوقت مجمّد' : phase === 'over' ? 'تجاوز الوقت المحجوز' : s.plannedMin ? 'الوقت المتبقي من ' + fmtMinutes(s.plannedMin) : 'مدة اللعب (وقت مفتوح)';
    const timerText = rem == null ? fmtClockDur(tot.ms) : (rem >= 0 ? fmtClockDur(rem) : '+' + fmtClockDur(-rem));
    const qty = s.items.reduce(function (a, i) { return a + i.qty; }, 0);
    html += '<div class="station-body">' +
      '<div class="station-player">' + icon('user') + '<span>' + esc(s.player) + '</span>' +
        (hasMulti(d) ? '<span class="mode-tag">' + (s.mode === 'multi' ? 'زوجي' : 'فردي') + '</span>' : '') + '</div>' +
      '<div class="timer-row">' +
        '<div><div class="timer" data-live="timer" data-sid="' + s.id + '">' + timerText + '</div><div class="timer-label">' + label + '</div></div>' +
        '<div class="cost"><div class="cost-value"><span data-live="cost" data-sid="' + s.id + '">' + fmtNum(tot.total) + '</span> <small class="faint">' + esc(cur()) + '</small></div><div class="cost-label">الحساب حتى الآن</div></div>' +
      '</div>' +
      (s.plannedMin ? '<div class="meter" aria-hidden="true"><i data-live="meter" data-sid="' + s.id + '" style="width:' + clamp(tot.ms / (s.plannedMin * Billing.MIN) * 100, 0, 100).toFixed(2) + '%"></i></div>' : '') +
      '<div class="station-meta"><span>بدأ <b>' + fmtTime(s.startedAt) + '</b></span>' +
        (s.plannedMin && phase !== 'paused' && rem > 0 ? '<span>ينتهي <b>' + fmtTime(now + rem) + '</b></span>' : '') +
        (qty ? '<span>طلبات <b>' + qty + '</b></span>' : '') +
        '<span><b>' + fmtNum(s.rate) + '</b>/ساعة</span></div>' +
    '</div>' +
    '<div class="station-actions">' +
      '<button class="btn btn-primary" data-action="checkout" data-session="' + s.id + '">' + icon('receipt', 'ic-sm') + 'إنهاء وحساب</button>' +
      '<button class="btn btn-icon" data-action="order" data-session="' + s.id + '" title="طلب من البوفيه" aria-label="طلب من البوفيه">' + icon('coffee') + '</button>' +
      '<button class="btn btn-icon" data-action="extend" data-session="' + s.id + '" title="' + (s.plannedMin ? 'تمديد الوقت' : 'تحديد مدة') + '" aria-label="' + (s.plannedMin ? 'تمديد الوقت' : 'تحديد مدة') + '">' + icon('timer') + '</button>' +
      '<button class="btn btn-icon" data-action="pause" data-session="' + s.id + '" title="' + (phase === 'paused' ? 'استئناف' : 'إيقاف مؤقت') + '" aria-label="' + (phase === 'paused' ? 'استئناف' : 'إيقاف مؤقت') + '">' + icon(phase === 'paused' ? 'play' : 'pause') + '</button>' +
      '<button class="btn btn-icon" data-action="session-menu" data-session="' + s.id + '" title="خيارات أخرى" aria-label="خيارات أخرى">' + icon('more') + '</button>' +
    '</div>';
  } else if (phase === 'maint') {
    html += '<div class="station-free"><span class="station-note">' + (d.note ? esc(d.note) : 'الجهاز خارج الخدمة حالياً') + '</span></div>' +
      '<div class="station-actions">' +
        '<button class="btn btn-grow" data-action="maint-toggle" data-device="' + esc(d.id) + '">' + icon('check', 'ic-sm') + 'إعادة للخدمة</button>' +
        '<button class="btn btn-icon" data-action="device-menu" data-device="' + esc(d.id) + '" title="خيارات الجهاز" aria-label="خيارات الجهاز">' + icon('more') + '</button>' +
      '</div>';
  } else {
    const r = nextReservation(d.id, now, 120);
    html += '<div class="station-free">' +
        '<span class="station-rate">' + money(rateOf(d, 'single')) + ' <small class="faint">/ ساعة</small></span>' +
        (hasMulti(d) ? '<span class="station-note">زوجي: ' + money(rateOf(d, 'multi')) + ' / ساعة</span>' : '') +
        (d.note ? '<span class="station-note">' + esc(d.note) + '</span>' : '') +
      '</div>' +
      (r ? '<div class="station-resv">' + icon('calendar') + '<span>محجوز ' + fmtTime(r.start) + ' — ' + esc(r.name) + '</span></div>' : '') +
      '<div class="station-actions">' +
        (r ? '<button class="btn btn-primary" data-action="resv-start" data-id="' + r.id + '">' + icon('play', 'ic-sm') + 'بدء الحجز</button>' +
             '<button class="btn btn-icon" data-action="start-session" data-device="' + esc(d.id) + '" title="جلسة عادية" aria-label="بدء جلسة عادية">' + icon('plus') + '</button>'
           : '<button class="btn btn-primary" data-action="start-session" data-device="' + esc(d.id) + '">' + icon('play', 'ic-sm') + 'بدء جلسة</button>' +
             '<button class="btn btn-icon" data-action="resv-new" data-device="' + esc(d.id) + '" title="حجز الجهاز" aria-label="حجز الجهاز">' + icon('calendarPlus') + '</button>') +
        '<button class="btn btn-icon" data-action="device-menu" data-device="' + esc(d.id) + '" title="خيارات الجهاز" aria-label="خيارات الجهاز">' + icon('more') + '</button>' +
      '</div>';
  }
  return html + '</article>';
}

function renderSide() {
  const box = $('#side');
  if (!box) return;
  const now = Date.now();

  const attention = state.sessions
    .map(function (s) { return { s: s, p: sessionPhase(s, now) }; })
    .filter(function (x) { return x.p === 'warn' || x.p === 'over' || x.p === 'paused'; })
    .sort(function (a, b) {
      const rank = { over: 0, warn: 1, paused: 2 };
      return rank[a.p] - rank[b.p] || (Billing.remainingMs(a.s, now) || 0) - (Billing.remainingMs(b.s, now) || 0);
    });
  const attHtml = attention.length ? '<div class="list">' + attention.map(function (x) {
    const d = deviceById(x.s.deviceId);
    const tone = x.p === 'over' ? 'danger' : 'warn';
    return '<div class="list-item"><span class="dot ' + tone + '"></span>' +
      '<div class="list-main"><div class="list-title">' + bdi(d ? d.name : '') + ' · ' + esc(x.s.player) + '</div>' +
      '<div class="list-sub">' + (x.p === 'paused' ? 'متوقف مؤقتاً' : x.p === 'over' ? 'تجاوز بـ <span class="hud" dir="ltr" data-live="timer" data-sid="' + x.s.id + '"></span>' : 'متبقي <span class="hud" dir="ltr" data-live="timer" data-sid="' + x.s.id + '"></span>') + '</div></div>' +
      '<button class="btn btn-sm ' + (x.p === 'over' ? 'btn-danger' : '') + '" data-action="' + (x.p === 'paused' ? 'pause' : 'checkout') + '" data-session="' + x.s.id + '">' + (x.p === 'paused' ? 'استئناف' : 'إنهاء') + '</button></div>';
  }).join('') + '</div>' : '<div class="empty" style="padding:10px">' + icon('check') + '<span>كل الجلسات ضمن وقتها</span></div>';

  const upcoming = state.reservations
    .filter(function (r) { const st = resvState(r, now); return r.status === 'booked' && st !== 'missed'; })
    .sort(function (a, b) { return a.start - b.start; })
    .slice(0, 5);
  const upHtml = upcoming.length ? '<div class="list">' + upcoming.map(function (r) {
    const d = deviceById(r.deviceId);
    const st = resvState(r, now);
    const pill = st === 'late' ? '<span class="pill warn">متأخر</span>' : st === 'due' ? '<span class="pill violet">حان الموعد</span>' : st === 'soon' ? '<span class="pill violet no-dot">خلال ' + Math.max(1, Math.round((r.start - now) / Billing.MIN)) + ' د</span>' : '';
    return '<div class="list-item"><span class="dot violet"></span>' +
      '<div class="list-main"><div class="list-title">' + esc(r.name) + '</div>' +
      '<div class="list-sub">' + relativeDay(r.start, now) + ' ' + fmtTime(r.start) + ' · ' + bdi(d ? d.name : 'جهاز محذوف') + ' · ' + fmtMinutes(r.minutes) + '</div></div>' +
      (pill || '<button class="btn btn-sm btn-ghost" data-action="resv-edit" data-id="' + r.id + '" aria-label="تعديل الحجز">' + icon('pencil', 'ic-sm') + '</button>') + '</div>';
  }).join('') + '</div>' : '<div class="empty" style="padding:10px">' + icon('calendar') + '<span>لا حجوزات قادمة</span></div>';

  const recent = state.history.slice(-5).reverse();
  const recHtml = recent.length ? '<div class="list">' + recent.map(function (r) {
    return '<button type="button" class="list-item" data-action="receipt" data-id="' + r.id + '" style="background:none;border-inline:0;border-bottom:0;text-align:start;width:100%">' +
      '<span class="dot ' + (r.kind === 'sale' ? '' : 'info') + '" style="' + (r.kind === 'sale' ? 'background:var(--s2)' : '') + '"></span>' +
      '<div class="list-main"><div class="list-title">' + bdi(r.deviceName) + (r.player ? ' · ' + esc(r.player) : '') + '</div>' +
      '<div class="list-sub">#' + r.no + ' · ' + fmtTime(r.endedAt) + (r.playedMs ? ' · ' + fmtDur(r.playedMs) : '') + '</div></div>' +
      '<div class="list-end num">' + fmtNum(r.total) + '</div></button>';
  }).join('') + '</div>' : '<div class="empty" style="padding:10px">' + icon('receipt') + '<span>لا عمليات بعد</span></div>';

  box.innerHTML =
    '<section class="panel"><div class="panel-head"><h2 class="panel-title">' + icon('bell') + 'تحتاج انتباهك</h2></div>' + attHtml + '</section>' +
    '<section class="panel"><div class="panel-head"><h2 class="panel-title">' + icon('calendar') + 'الحجوزات القادمة</h2><a class="btn btn-sm btn-ghost" href="#bookings">الكل</a></div>' + upHtml + '</section>' +
    '<section class="panel"><div class="panel-head"><h2 class="panel-title">' + icon('receipt') + 'آخر العمليات</h2><a class="btn btn-sm btn-ghost" href="#reports">السجل</a></div>' + recHtml + '</section>';
  updateLive(now);
}

/* =================== الحجوزات =================== */

function renderBookings() {
  const now = Date.now();
  setTopbar('الحجوزات', 'مهلة انتظار صاحب الحجز: ' + state.settings.holdMinutes + ' دقيقة',
    '<button class="btn btn-primary" data-action="resv-new">' + icon('calendarPlus', 'ic-sm') + 'حجز جديد</button>');
  const upcoming = state.reservations.filter(function (r) { return r.status === 'booked'; }).sort(function (a, b) { return a.start - b.start; });
  const past = state.reservations.filter(function (r) { return r.status !== 'booked'; }).sort(function (a, b) { return b.start - a.start; });

  let body = '<div class="filters"><div class="seg" role="group" aria-label="نوع القائمة">' +
    '<button type="button" data-action="res-tab" data-value="upcoming" aria-pressed="' + (ui.resTab === 'upcoming') + '">القادمة <span class="count num">' + upcoming.length + '</span></button>' +
    '<button type="button" data-action="res-tab" data-value="past" aria-pressed="' + (ui.resTab === 'past') + '">السابقة <span class="count num">' + past.length + '</span></button>' +
    '</div></div>';

  if (ui.resTab === 'upcoming') {
    if (!upcoming.length) {
      body += '<div class="panel empty">' + icon('calendar') + '<b style="color:var(--fg)">لا توجد حجوزات قادمة</b><span>سجّل حجوزات الزبائن مسبقاً ليظهر تنبيه على الجهاز قبل الموعد.</span>' +
        '<button class="btn btn-primary" data-action="resv-new">' + icon('calendarPlus', 'ic-sm') + 'حجز جديد</button></div>';
    } else {
      const groups = [];
      upcoming.forEach(function (r) {
        const k = dayKey(r.start);
        let g = groups.find(function (x) { return x.k === k; });
        if (!g) { g = { k: k, ts: r.start, items: [] }; groups.push(g); }
        g.items.push(r);
      });
      body += '<div class="stack">' + groups.map(function (g) {
        return '<section class="panel"><div class="panel-head"><h2 class="panel-title">' + relativeDay(g.ts, now) + '</h2><span class="panel-sub">' + fmtDateFull(g.ts) + '</span></div>' +
          '<div class="list">' + g.items.map(function (r) { return resvRow(r, now); }).join('') + '</div></section>';
      }).join('') + '</div>';
    }
  } else {
    body += past.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>التاريخ</th><th>الوقت</th><th>الاسم</th><th>الهاتف</th><th>الجهاز</th><th>المدة</th><th>الحالة</th><th class="actions"></th></tr></thead><tbody>' +
      past.map(function (r) {
        const d = deviceById(r.deviceId);
        const st = { done: ['تم', 'ok'], started: ['بدأ', 'info'], cancelled: ['ملغى', 'idle'], noshow: ['لم يحضر', 'danger'] }[r.status] || [r.status, 'idle'];
        return '<tr><td>' + fmtDate(r.start, true) + '</td><td class="num">' + fmtTime(r.start) + '</td><td>' + esc(r.name) + '</td><td class="num" dir="ltr">' + esc(r.phone || '—') + '</td><td>' + bdi(d ? d.name : '—') + '</td><td>' + fmtMinutes(r.minutes) + '</td>' +
          '<td><span class="pill ' + st[1] + '">' + st[0] + '</span></td>' +
          '<td class="actions"><button class="btn btn-ghost btn-icon btn-sm" data-action="resv-delete" data-id="' + r.id + '" aria-label="حذف">' + icon('trash', 'ic-sm') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>'
      : '<div class="panel empty">' + icon('history') + '<span>لا توجد حجوزات سابقة.</span></div>';
  }
  $('#view').innerHTML = body;
}

function resvRow(r, now) {
  const d = deviceById(r.deviceId);
  const st = resvState(r, now);
  const end = r.start + r.minutes * Billing.MIN;
  const pill = {
    late: '<span class="pill warn">متأخر ' + Math.round((now - r.start) / Billing.MIN) + ' د</span>',
    due: '<span class="pill violet">حان الموعد</span>',
    soon: '<span class="pill violet">خلال ' + Math.max(1, Math.round((r.start - now) / Billing.MIN)) + ' د</span>',
    missed: '<span class="pill danger">فات الموعد</span>',
    later: ''
  }[st];
  const busy = d && (sessionOfDevice(d.id) || d.maintenance);
  return '<div class="list-item" style="flex-wrap:wrap">' +
    '<div class="hud" style="min-width:108px;font-size:15px;font-weight:600">' + fmtTime(r.start) + '<div class="faint" style="font-size:12px">حتى ' + fmtTime(end) + '</div></div>' +
    '<div class="list-main" style="min-width:160px">' +
      '<div class="list-title">' + esc(r.name) + ' ' + pill + '</div>' +
      '<div class="list-sub">' + bdi(d ? d.name : 'جهاز محذوف') + ' · ' + fmtMinutes(r.minutes) +
        (r.phone ? ' · <span dir="ltr" class="num">' + esc(r.phone) + '</span>' : '') + (r.note ? ' · ' + esc(r.note) : '') + '</div>' +
    '</div>' +
    '<div class="row" style="gap:6px">' +
      '<button class="btn btn-sm btn-primary" data-action="resv-start" data-id="' + r.id + '"' + (busy ? ' disabled title="الجهاز غير متاح الآن"' : '') + '>' + icon('play', 'ic-sm') + 'بدء</button>' +
      '<button class="btn btn-sm" data-action="resv-edit" data-id="' + r.id + '">' + icon('pencil', 'ic-sm') + 'تعديل</button>' +
      (st === 'late' || st === 'missed' ? '<button class="btn btn-sm" data-action="resv-noshow" data-id="' + r.id + '">لم يحضر</button>' : '') +
      '<button class="btn btn-sm btn-ghost" data-action="resv-cancel" data-id="' + r.id + '">إلغاء</button>' +
    '</div></div>';
}

/* =================== البوفيه =================== */

function renderShop() {
  setTopbar('البوفيه', 'بيع مباشر وإدارة المخزون', '<button class="btn btn-primary" data-action="product-new">' + icon('plus', 'ic-sm') + 'منتج جديد</button>');
  $('#view').innerHTML =
    '<div class="shop">' +
      '<section style="min-width:0">' +
        '<div class="filters" id="shop-tools"></div>' +
        '<div id="low-stock"></div>' +
        '<div class="products" id="products"></div>' +
      '</section>' +
      '<aside class="side"><section class="panel" id="cart"></section></aside>' +
    '</div>';
  renderShopTools();
  renderProducts();
  renderCart();
}

function renderShopTools() {
  $('#shop-tools').innerHTML =
    '<div class="seg" role="group" aria-label="الفئة">' +
      '<button type="button" data-action="shop-cat" data-value="all" aria-pressed="' + (ui.shopCat === 'all') + '">الكل</button>' +
      PRODUCT_CATEGORIES.map(function (c) {
        return '<button type="button" data-action="shop-cat" data-value="' + c.id + '" aria-pressed="' + (ui.shopCat === c.id) + '">' + c.name + '</button>';
      }).join('') +
    '</div>' +
    '<label class="search"><span class="sr-only">بحث</span>' + icon('search', 'ic-sm') +
    '<input class="input" id="shop-search" type="search" placeholder="ابحث عن منتج" value="' + esc(ui.shopSearch) + '" autocomplete="off"></label>';
}

function catOf(p) { return PRODUCT_CATEGORIES.find(function (c) { return c.id === p.category; }) || PRODUCT_CATEGORIES[0]; }

function stockLabel(p) {
  if (p.stock == null) return '<span class="product-stock">غير محدود</span>';
  if (p.stock <= 0) return '<span class="product-stock out">نفد المخزون</span>';
  if (p.stock <= 5) return '<span class="product-stock low">متبقٍ ' + p.stock + ' فقط</span>';
  return '<span class="product-stock">المخزون: <span class="num">' + p.stock + '</span></span>';
}

function renderProducts() {
  const box = $('#products');
  if (!box) return;
  const q = ui.shopSearch.trim().toLowerCase();
  const list = state.products.filter(function (p) {
    return (ui.shopCat === 'all' || p.category === ui.shopCat) && (!q || p.name.toLowerCase().indexOf(q) !== -1);
  });
  const low = state.products.filter(function (p) { return p.stock != null && p.stock <= 5; });
  $('#low-stock').innerHTML = low.length
    ? '<div class="banner warn">' + icon('package') + '<p><b>مخزون منخفض:</b> ' + low.map(function (p) { return esc(p.name) + ' (' + p.stock + ')'; }).join('، ') + '</p></div>'
    : '';
  if (!state.products.length) {
    box.innerHTML = '<div class="panel empty" style="grid-column:1/-1">' + icon('coffee') + '<span>لا توجد منتجات. أضف مشروبات وسناكات لبيعها أو إضافتها لحساب الجلسات.</span>' +
      '<button class="btn btn-primary" data-action="product-new">' + icon('plus', 'ic-sm') + 'منتج جديد</button></div>';
    return;
  }
  if (!list.length) {
    box.innerHTML = '<div class="panel empty" style="grid-column:1/-1">' + icon('search') + '<span>لا منتجات تطابق البحث.</span></div>';
    return;
  }
  box.innerHTML = list.map(function (p) {
    const out = p.stock != null && p.stock <= 0;
    return '<div class="product-wrap">' +
      '<button type="button" class="product" data-action="cart-add" data-id="' + p.id + '"' + (out ? ' disabled' : '') + '>' +
        '<span class="product-icon">' + icon(catOf(p).icon) + '</span>' +
        '<span class="product-name">' + esc(p.name) + '</span>' +
        '<span class="product-price">' + money(p.price) + '</span>' +
        stockLabel(p) +
      '</button>' +
      '<button type="button" class="btn btn-ghost btn-icon btn-sm product-edit" data-action="product-edit" data-id="' + p.id + '" aria-label="تعديل ' + esc(p.name) + '">' + icon('pencil', 'ic-sm') + '</button>' +
    '</div>';
  }).join('');
}

function renderCart() {
  const box = $('#cart');
  if (!box) return;
  const total = Billing.itemsTotal(state.cart);
  const count = state.cart.reduce(function (a, i) { return a + i.qty; }, 0);
  box.innerHTML =
    '<div class="panel-head"><h2 class="panel-title">' + icon('cart') + 'بيع مباشر</h2>' +
      (count ? '<button class="btn btn-sm btn-ghost" data-action="cart-clear">تفريغ</button>' : '') + '</div>' +
    (state.cart.length
      ? '<div class="cart-lines">' + state.cart.map(function (i) {
          return '<div class="cart-line"><div class="list-main"><div class="list-title">' + esc(i.name) + '</div><div class="list-sub num">' + fmtNum(i.price) + ' × ' + i.qty + ' = ' + fmtNum(i.price * i.qty) + '</div></div>' +
            '<div class="qty"><button class="btn btn-icon btn-sm" data-action="cart-dec" data-id="' + i.productId + '" aria-label="إنقاص">' + icon('minus', 'ic-sm') + '</button><b>' + i.qty + '</b>' +
            '<button class="btn btn-icon btn-sm" data-action="cart-inc" data-id="' + i.productId + '" aria-label="زيادة">' + icon('plus', 'ic-sm') + '</button></div></div>';
        }).join('') + '</div>' +
        '<hr class="divider" style="margin:14px 0">' +
        '<div class="sum-rows"><div class="sum-row total"><span>الإجمالي</span><span>' + money(total) + '</span></div></div>' +
        '<button class="btn btn-primary btn-lg btn-block" style="margin-top:14px" data-action="cart-checkout">' + icon('banknote', 'ic-sm') + 'إتمام البيع</button>'
      : '<div class="empty">' + icon('cart') + '<span>اضغط على أي منتج لإضافته. لإضافة طلب لحساب جهاز استخدم زر البوفيه في بطاقة الجهاز.</span></div>');
}
