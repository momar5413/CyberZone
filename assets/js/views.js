/* CyberZone — الشاشات: الصالة، الحجوزات، البوفيه */
'use strict';

/* =================== الصالة =================== */

function renderFloor() {
  const now = Date.now();
  setTopbar('الصالة', fmtDate(now, true),
    '<button class="btn" data-action="resv-new">' + icon('calendarPlus', 'ic-sm') + 'حجز جديد</button>' +
    '<button class="btn" data-action="device-add">' + icon('plus', 'ic-sm') + 'إضافة جهاز</button>');
  $('#view').innerHTML =
    '<div class="board" id="board" role="group" aria-label="ملخص الصالة"></div>' +
    '<div class="floor">' +
      '<section aria-label="الأجهزة" style="min-width:0">' +
        '<div class="toolbar" id="floor-tools"></div>' +
        '<div id="stations"></div>' +
      '</section>' +
      '<aside class="side" id="side" aria-label="الآن"></aside>' +
    '</div>';
  refreshFloor();
}

function refreshFloor() {
  if (!$('#stations')) return;
  renderBoard();
  renderFloorTools();
  renderStations();
  renderSide();
}

function todayRecords(now) {
  const t0 = startOfDay(now);
  return state.history.filter(function (r) { return r.endedAt >= t0; });
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

// لوحة الملخّص: خانات الحالة تعمل كفلتر، والأرقام المالية للمتابعة
function renderBoard() {
  const now = Date.now();
  const c = floorCounts(now);
  const revenue = todayRecords(now).reduce(function (a, r) { return a + r.total; }, 0);
  const t0 = startOfDay(now);
  const bookings = state.reservations.filter(function (r) { return r.status === 'booked' && r.start >= t0 && r.start < addDays(t0, 1); }).length;
  const cells = [
    ['all', 'كل الأجهزة', ''],
    ['free', 'متاح', 'go'],
    ['busy', 'يلعب', 'brand'],
    ['alert', 'ينتهي أو انتهى', 'amber'],
    ['maint', 'صيانة', '']
  ];
  $('#board').innerHTML = cells.map(function (x) {
    return '<button type="button" class="cell" data-action="floor-status" data-value="' + x[0] + '" aria-pressed="' + (ui.floorStatus === x[0]) + '">' +
      '<span class="cell-label"><span class="lamp ' + x[2] + '"></span>' + x[1] + '</span>' +
      '<span class="cell-num led"' + (x[0] === 'alert' && c.alert ? ' style="color:var(--amber)"' : '') + '>' + c[x[0]] + '</span></button>';
  }).join('') +
  '<span class="cell-gap" aria-hidden="true"></span>' +
  '<div class="cell"><span class="cell-label">قيد التحصيل الآن</span><span class="cell-num led"><span data-live="pending">' + fmtNum(pendingTotal(now)) + '</span><small>' + esc(cur()) + '</small></span></div>' +
  '<div class="cell"><span class="cell-label">دخل اليوم</span><span class="cell-num led">' + fmtNum(revenue) + '<small>' + esc(cur()) + '</small></span></div>' +
  '<a class="cell" href="#bookings" style="text-decoration:none"><span class="cell-label">حجوزات اليوم</span><span class="cell-num led">' + bookings + '</span></a>';
}

function renderFloorTools() {
  const usedTypes = state.types.filter(function (t) { return state.devices.some(function (d) { return d.typeId === t.id; }); });
  $('#floor-tools').innerHTML =
    (usedTypes.length > 1
      ? '<div class="row" style="gap:6px">' +
        '<button type="button" class="chip" data-action="floor-type" data-value="all" aria-pressed="' + (ui.floorType === 'all') + '">كل الأنواع</button>' +
        usedTypes.map(function (t) {
          return '<button type="button" class="chip" data-action="floor-type" data-value="' + esc(t.id) + '" aria-pressed="' + (ui.floorType === t.id) + '">' + esc(t.name) + '</button>';
        }).join('') + '</div>'
      : '') +
    '<span class="spacer"></span>' +
    '<label class="search"><span class="sr-only">بحث</span>' + icon('search', 'ic-sm') +
    '<input class="input" id="floor-search" type="search" placeholder="جهاز أو لاعب" value="' + esc(ui.floorSearch) + '" autocomplete="off"></label>' +
    '<div class="seg" role="group" aria-label="طريقة العرض">' +
      '<button type="button" data-action="floor-view" data-value="grid" aria-pressed="' + (ui.floorView !== 'list') + '" title="بطاقات">' + icon('grid', 'ic-sm') + '<span class="sr-only">بطاقات</span></button>' +
      '<button type="button" data-action="floor-view" data-value="list" aria-pressed="' + (ui.floorView === 'list') + '" title="قائمة">' + icon('menu', 'ic-sm') + '<span class="sr-only">قائمة</span></button>' +
    '</div>';
}

function filteredDevices(now) {
  const q = ui.floorSearch.trim().toLowerCase();
  return state.devices.filter(function (d) {
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
}

function renderStations() {
  const box = $('#stations');
  if (!box) return;
  const now = Date.now();
  if (!state.devices.length) {
    box.className = '';
    box.innerHTML = '<div class="panel empty"><b>لا توجد أجهزة بعد</b><span>أضف أجهزة صالتك بأسعارها لتبدأ تسجيل الجلسات، أو جهّزها كلها دفعة واحدة.</span>' +
      '<div class="row"><button class="btn btn-primary" data-action="setup-open">جهّز صالتي</button><button class="btn" data-action="device-add">إضافة جهاز واحد</button></div></div>';
    return;
  }
  const list = filteredDevices(now);
  if (!list.length) {
    box.className = '';
    box.innerHTML = '<div class="panel empty"><span>لا أجهزة تطابق هذه التصفية.</span><button class="btn btn-sm" data-action="floor-reset">عرض كل الأجهزة</button></div>';
    return;
  }
  if (ui.floorView === 'list') {
    box.className = 'rows';
    box.innerHTML = list.map(function (d) { return stationRow(d, now); }).join('');
  } else {
    box.className = 'stations';
    box.innerHTML = list.map(function (d) { return stationCard(d, now); }).join('');
  }
}

function timerText(s, now) {
  const rem = Billing.remainingMs(s, now);
  return rem == null ? fmtClockDur(Billing.elapsedMs(s, now)) : (rem >= 0 ? fmtClockDur(rem) : '+' + fmtClockDur(-rem));
}

function timerLabel(s, phase, now) {
  if (phase === 'paused') return 'متوقف — لا يُحتسب الوقت';
  if (phase === 'over') return 'تجاوز ' + fmtMinutes(s.plannedMin) + ' المحجوزة';
  if (s.plannedMin) {
    const rem = Billing.remainingMs(s, now);
    return 'متبقٍ من ' + fmtMinutes(s.plannedMin) + ' · ينتهي ' + fmtTime(now + rem);
  }
  return 'وقت مفتوح منذ ' + fmtTime(s.startedAt);
}

function sessionActions(s, phase, compact) {
  return '<div class="tile-actions">' +
    '<button class="btn btn-primary' + (compact ? ' btn-sm' : '') + '" data-action="checkout" data-session="' + s.id + '">إنهاء وحساب</button>' +
    '<button class="btn btn-icon' + (compact ? ' btn-sm' : '') + '" data-action="order" data-session="' + s.id + '" title="طلب من البوفيه" aria-label="طلب من البوفيه">' + icon('coffee') + '</button>' +
    '<button class="btn btn-icon' + (compact ? ' btn-sm' : '') + '" data-action="extend" data-session="' + s.id + '" title="' + (s.plannedMin ? 'تمديد الوقت' : 'تحديد مدة') + '" aria-label="' + (s.plannedMin ? 'تمديد الوقت' : 'تحديد مدة') + '">' + icon('timer') + '</button>' +
    '<button class="btn btn-icon' + (compact ? ' btn-sm' : '') + '" data-action="pause" data-session="' + s.id + '" title="' + (phase === 'paused' ? 'استئناف' : 'إيقاف مؤقت') + '" aria-label="' + (phase === 'paused' ? 'استئناف' : 'إيقاف مؤقت') + '">' + icon(phase === 'paused' ? 'play' : 'pause') + '</button>' +
    '<button class="btn btn-icon' + (compact ? ' btn-sm' : '') + '" data-action="session-menu" data-session="' + s.id + '" title="تعديل، نقل، إلغاء" aria-label="خيارات الجلسة">' + icon('more') + '</button>' +
  '</div>';
}

function rateLine(d) {
  return '<span class="num">' + fmtNum(rateOf(d, 'single')) + '</span> ' + esc(cur()) + ' للساعة' + (hasMulti(d) ? ' · زوجي <span class="num">' + fmtNum(rateOf(d, 'multi')) + '</span>' : '');
}

function stationCard(d, now) {
  const t = typeOf(d);
  const s = sessionOfDevice(d.id);
  const phase = devicePhase(d, now);
  const lab = PHASE_LABEL[phase];
  let html = '<article class="tile" data-phase="' + phase + '" data-device="' + esc(d.id) + '">' +
    '<div class="tile-head">' +
      '<div style="min-width:0"><h3 class="tile-name">' + bdi(d.name) + '</h3><div class="tile-meta">' + esc(t.name) + '</div></div>' +
      '<span class="tag ' + lab[1] + '">' + lab[0] + '</span>' +
    '</div>';

  if (s) {
    const tot = sessionTotals(s, now);
    const qty = s.items.reduce(function (a, i) { return a + i.qty; }, 0);
    html += '<div class="readout">' +
        '<div><div class="timer led" data-live="timer" data-sid="' + s.id + '">' + timerText(s, now) + '</div>' +
        '<div class="timer-label">' + timerLabel(s, phase, now) + '</div></div>' +
        '<div class="bill"><div class="bill-num led"><span data-live="cost" data-sid="' + s.id + '">' + fmtNum(tot.total) + '</span><small>' + esc(cur()) + '</small></div><div class="bill-label">الحساب حتى الآن</div></div>' +
      '</div>' +
      (s.plannedMin ? '<div class="ledbar" aria-hidden="true"><i data-live="meter" data-sid="' + s.id + '" style="width:' + ledWidth(s, now) + '"></i></div>' : '') +
      '<div class="tile-line"><span class="player">' + esc(s.player) + '</span>' +
        (hasMulti(d) ? '<span class="mode">' + (s.mode === 'multi' ? 'زوجي' : 'فردي') + '</span>' : '') +
        '<span>بدأ <b>' + fmtTime(s.startedAt) + '</b></span>' +
        (qty ? '<span>طلبات <b>' + qty + '</b></span>' : '') + '</div>' +
      sessionActions(s, phase, false);
  } else if (phase === 'maint') {
    html += '<div class="readout"><div><div class="timer led off">--:--</div><div class="timer-label">' + (d.note ? esc(d.note) : 'خارج الخدمة') + '</div></div></div>' +
      '<div class="tile-actions">' +
        '<button class="btn btn-grow" data-action="maint-toggle" data-device="' + esc(d.id) + '">إعادة للخدمة</button>' +
        '<button class="btn btn-icon" data-action="device-menu" data-device="' + esc(d.id) + '" title="خيارات الجهاز" aria-label="خيارات الجهاز">' + icon('more') + '</button>' +
      '</div>';
  } else {
    const r = nextReservation(d.id, now, 120);
    html += '<div class="readout"><div><div class="timer led off">--:--</div><div class="timer-label">' + rateLine(d) + (d.note ? ' · ' + esc(d.note) : '') + '</div></div></div>';
    if (r) {
      html += '<div class="resv-line">' + icon('calendar', 'ic-sm') + '<span>محجوز ' + fmtTime(r.start) + ' لـ ' + esc(r.name) + '</span></div>' +
        '<div class="tile-actions">' +
          '<button class="btn btn-primary" data-action="resv-start" data-id="' + r.id + '">بدء الحجز</button>' +
          '<button class="btn" data-action="start-session" data-device="' + esc(d.id) + '">جلسة أخرى</button>' +
          '<button class="btn btn-icon" data-action="device-menu" data-device="' + esc(d.id) + '" title="خيارات الجهاز" aria-label="خيارات الجهاز">' + icon('more') + '</button>' +
        '</div>';
    } else {
      html += '<div class="keys" role="group" aria-label="بدء سريع">' +
        quickKey(d, 0, '', 'مفتوح', 'بالدقيقة') + quickKey(d, 30, '30', '', 'دقيقة') + quickKey(d, 60, '1', '', 'ساعة') + quickKey(d, 120, '2', '', 'ساعة') +
        '<button type="button" class="key more" data-action="device-menu" data-device="' + esc(d.id) + '" title="بدء بخيارات، حجز، تعديل" aria-label="خيارات الجهاز">' + icon('more', 'ic-sm') + '</button>' +
      '</div>';
    }
  }
  return html + '</article>';
}

function quickKey(d, minutes, ledText, text, unit) {
  const label = minutes ? 'بدء ' + fmtMinutes(minutes) + ' فوراً' : 'بدء وقت مفتوح فوراً';
  return '<button type="button" class="key' + (minutes ? '' : ' start') + '" data-action="quick-start" data-device="' + esc(d.id) + '" data-min="' + minutes + '" title="' + label + '" aria-label="' + label + '">' +
    (ledText ? '<span class="led">' + ledText + '</span>' : text) + '<small>' + unit + '</small></button>';
}

function stationRow(d, now) {
  const s = sessionOfDevice(d.id);
  const phase = devicePhase(d, now);
  const lab = PHASE_LABEL[phase];
  let html = '<div class="srow" data-phase="' + phase + '" data-device="' + esc(d.id) + '">' +
    '<div class="srow-tag"><span class="tag ' + lab[1] + '">' + lab[0] + '</span></div>' +
    '<div class="srow-name"><b>' + bdi(d.name) + '</b><div class="tile-meta">' + esc(typeOf(d).name) + '</div></div>';
  if (s) {
    html += '<div class="srow-player tile-line"><span class="player">' + esc(s.player) + '</span>' + (hasMulti(d) ? '<span class="mode">' + (s.mode === 'multi' ? 'زوجي' : 'فردي') + '</span>' : '') + '</div>' +
      '<div class="timer led" data-live="timer" data-sid="' + s.id + '">' + timerText(s, now) + '</div>' +
      '<div class="bill-num led"><span data-live="cost" data-sid="' + s.id + '">' + fmtNum(sessionTotals(s, now).total) + '</span></div>' +
      sessionActions(s, phase, true);
  } else {
    const r = phase === 'free' ? nextReservation(d.id, now, 120) : null;
    html += '<div class="srow-player tile-line">' + (r ? '<span style="color:var(--brand)">محجوز ' + fmtTime(r.start) + ' · ' + esc(r.name) + '</span>' : '<span class="faint">' + (phase === 'maint' ? esc(d.note || 'خارج الخدمة') : rateLine(d)) + '</span>') + '</div>' +
      '<div class="timer led off">--:--</div><div></div>' +
      '<div class="tile-actions">' +
        (phase === 'maint'
          ? '<button class="btn btn-sm" data-action="maint-toggle" data-device="' + esc(d.id) + '">إعادة للخدمة</button>'
          : r ? '<button class="btn btn-sm btn-primary" data-action="resv-start" data-id="' + r.id + '">بدء الحجز</button>'
              : '<button class="btn btn-sm btn-primary" data-action="start-session" data-device="' + esc(d.id) + '">بدء جلسة</button>') +
        '<button class="btn btn-icon btn-sm" data-action="device-menu" data-device="' + esc(d.id) + '" aria-label="خيارات الجهاز">' + icon('more') + '</button>' +
      '</div>';
  }
  return html + '</div>';
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
    const tone = x.p === 'over' ? 'red' : x.p === 'warn' ? 'amber' : '';
    return '<div class="item"><span class="lamp ' + tone + '"></span>' +
      '<div class="item-main"><div class="item-title">' + bdi(d ? d.name : '') + ' · ' + esc(x.s.player) + '</div>' +
      '<div class="item-sub">' + (x.p === 'paused' ? 'متوقف مؤقتاً' : x.p === 'over' ? 'تجاوز الوقت' : 'متبقٍ') + '</div></div>' +
      (x.p === 'paused' ? '' : '<span class="led" style="color:var(--' + tone + ')" data-live="timer" data-sid="' + x.s.id + '">' + timerText(x.s, now) + '</span>') +
      '<button class="btn btn-sm' + (x.p === 'over' ? ' btn-danger' : '') + '" data-action="' + (x.p === 'paused' ? 'pause' : 'checkout') + '" data-session="' + x.s.id + '">' + (x.p === 'paused' ? 'استئناف' : 'إنهاء') + '</button></div>';
  }).join('') + '</div>' : '<p class="now-empty">كل الجلسات ضمن وقتها.</p>';

  const upcoming = state.reservations
    .filter(function (r) { return r.status === 'booked' && resvState(r, now) !== 'missed'; })
    .sort(function (a, b) { return a.start - b.start; })
    .slice(0, 4);
  const upHtml = upcoming.length ? '<div class="list">' + upcoming.map(function (r) {
    const d = deviceById(r.deviceId);
    const st = resvState(r, now);
    const note = st === 'late' ? '<span class="tag amber">متأخر</span>' : st === 'due' ? '<span class="tag brand">حان الموعد</span>' : st === 'soon' ? '<span class="tag brand">بعد ' + Math.max(1, Math.round((r.start - now) / Billing.MIN)) + ' د</span>' : '';
    return '<button type="button" class="item" data-action="resv-edit" data-id="' + r.id + '">' +
      '<span class="led" style="min-width:3.2ch">' + fmtClockHM(r.start) + '</span>' +
      '<div class="item-main"><div class="item-title">' + esc(r.name) + '</div>' +
      '<div class="item-sub">' + (relativeDay(r.start, now) === 'اليوم' ? '' : relativeDay(r.start, now) + ' · ') + bdi(d ? d.name : 'جهاز محذوف') + ' · ' + fmtMinutes(r.minutes) + '</div></div>' +
      note + '</button>';
  }).join('') + '</div>' : '<p class="now-empty">لا حجوزات قادمة.</p>';

  const recent = state.history.slice(-5).reverse();
  const recHtml = recent.length ? '<div class="list">' + recent.map(function (r) {
    return '<button type="button" class="item" data-action="receipt" data-id="' + r.id + '">' +
      '<span class="mono faint">#' + r.no + '</span>' +
      '<div class="item-main"><div class="item-title">' + bdi(r.deviceName) + (r.player ? ' · ' + esc(r.player) : '') + '</div>' +
      '<div class="item-sub">' + fmtTime(r.endedAt) + (r.playedMs ? ' · ' + fmtDur(r.playedMs) : '') + '</div></div>' +
      '<span class="item-end num">' + fmtNum(r.total) + '</span></button>';
  }).join('') + '</div>' : '<p class="now-empty">لا إيصالات بعد.</p>';

  box.innerHTML = '<div class="now">' +
    '<section class="now-sec"><h2 class="now-title">تحتاج انتباهك' + (attention.length ? ' <span class="led" style="font-size:20px;color:var(--fg)">' + attention.length + '</span>' : '') + '</h2>' + attHtml + '</section>' +
    '<section class="now-sec"><h2 class="now-title">الحجوزات القادمة <a href="#bookings">الكل</a></h2>' + upHtml + '</section>' +
    '<section class="now-sec"><h2 class="now-title">آخر الإيصالات <a href="#reports">السجل</a></h2>' + recHtml + '</section>' +
  '</div>';
}

// 7:45 بدون لاحقة (للعرض بخط اللوحة)
function fmtClockHM(ts) {
  const d = new Date(ts);
  return (d.getHours() % 12 || 12) + ':' + pad2(d.getMinutes());
}

/* =================== الحجوزات =================== */

function renderBookings() {
  const now = Date.now();
  setTopbar('الحجوزات', 'ينتظر الحجز ' + state.settings.holdMinutes + ' دقيقة بعد موعده ثم يُعلَّم متأخراً',
    '<button class="btn btn-primary" data-action="resv-new">' + icon('calendarPlus', 'ic-sm') + 'حجز جديد</button>');
  const upcoming = state.reservations.filter(function (r) { return r.status === 'booked'; }).sort(function (a, b) { return a.start - b.start; });
  const past = state.reservations.filter(function (r) { return r.status !== 'booked'; }).sort(function (a, b) { return b.start - a.start; });

  let body = '<div class="filters"><div class="seg" role="group" aria-label="القائمة">' +
    '<button type="button" data-action="res-tab" data-value="upcoming" aria-pressed="' + (ui.resTab === 'upcoming') + '">القادمة <span class="count">' + upcoming.length + '</span></button>' +
    '<button type="button" data-action="res-tab" data-value="past" aria-pressed="' + (ui.resTab === 'past') + '">السابقة <span class="count">' + past.length + '</span></button>' +
    '</div></div>';

  if (ui.resTab === 'upcoming') {
    if (!upcoming.length) {
      body += '<div class="panel empty"><b>لا توجد حجوزات قادمة</b><span>سجّل حجز الزبون مسبقاً، فيظهر على بطاقة الجهاز قبل موعده بساعتين ويُمنع أي حجز متعارض معه.</span>' +
        '<button class="btn btn-primary" data-action="resv-new">حجز جديد</button></div>';
    } else {
      const groups = [];
      upcoming.forEach(function (r) {
        const k = dayKey(r.start);
        let g = groups.find(function (x) { return x.k === k; });
        if (!g) { g = { k: k, ts: r.start, items: [] }; groups.push(g); }
        g.items.push(r);
      });
      body += '<div class="panel">' + groups.map(function (g) {
        return '<section class="day-block"><div class="day-head"><h2>' + relativeDay(g.ts, now) + '</h2><span>' + fmtDateFull(g.ts) + ' · ' + g.items.length + ' حجز</span></div>' +
          g.items.map(function (r) { return resvRow(r, now); }).join('') + '</section>';
      }).join('') + '</div>';
    }
  } else {
    body += past.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>التاريخ</th><th>الوقت</th><th>الاسم</th><th>الهاتف</th><th>الجهاز</th><th>المدة</th><th>الحالة</th><th class="actions"></th></tr></thead><tbody>' +
      past.map(function (r) {
        const d = deviceById(r.deviceId);
        const st = { done: ['حضر', 'go'], started: ['بدأ', 'run'], cancelled: ['ملغى', 'idle'], noshow: ['لم يحضر', 'red'] }[r.status] || [r.status, 'idle'];
        return '<tr><td>' + fmtDate(r.start, true) + '</td><td class="num">' + fmtTime(r.start) + '</td><td>' + esc(r.name) + '</td><td class="mono" dir="ltr">' + esc(r.phone || '—') + '</td><td>' + bdi(d ? d.name : '—') + '</td><td>' + fmtMinutes(r.minutes) + '</td>' +
          '<td><span class="tag ' + st[1] + '">' + st[0] + '</span></td>' +
          '<td class="actions"><button class="btn btn-ghost btn-icon btn-sm" data-action="resv-delete" data-id="' + r.id + '" aria-label="حذف الحجز">' + icon('trash', 'ic-sm') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>'
      : '<div class="panel empty"><span>لا توجد حجوزات سابقة.</span></div>';
  }
  $('#view').innerHTML = body;
}

function resvRow(r, now) {
  const d = deviceById(r.deviceId);
  const st = resvState(r, now);
  const end = r.start + r.minutes * Billing.MIN;
  const tag = {
    late: '<span class="tag amber">متأخر ' + Math.round((now - r.start) / Billing.MIN) + ' د</span>',
    due: '<span class="tag brand">حان الموعد</span>',
    soon: '<span class="tag brand">بعد ' + Math.max(1, Math.round((r.start - now) / Billing.MIN)) + ' د</span>',
    missed: '<span class="tag red">فات الموعد</span>',
    later: ''
  }[st];
  const busy = d && (sessionOfDevice(d.id) || d.maintenance);
  return '<div class="resv">' +
    '<div class="resv-time"><span class="led">' + fmtClockHM(r.start) + '</span><small>' + (new Date(r.start).getHours() < 12 ? 'صباحاً' : 'مساءً') + '</small><small>حتى ' + fmtTime(end) + '</small></div>' +
    '<div style="min-width:0">' +
      '<div class="resv-name">' + esc(r.name) + ' ' + tag + '</div>' +
      '<div class="resv-sub">' + bdi(d ? d.name : 'جهاز محذوف') + ' · ' + fmtMinutes(r.minutes) +
        (r.phone ? ' · <span dir="ltr" class="mono">' + esc(r.phone) + '</span>' : '') + (r.note ? ' · ' + esc(r.note) : '') + '</div>' +
    '</div>' +
    '<div class="row" style="gap:6px">' +
      '<button class="btn btn-sm btn-primary" data-action="resv-start" data-id="' + r.id + '"' + (busy ? ' disabled title="الجهاز غير متاح الآن"' : '') + '>بدء</button>' +
      '<button class="btn btn-sm" data-action="resv-edit" data-id="' + r.id + '">تعديل</button>' +
      (st === 'late' || st === 'missed' ? '<button class="btn btn-sm" data-action="resv-noshow" data-id="' + r.id + '">لم يحضر</button>' : '') +
      '<button class="btn btn-sm btn-ghost" data-action="resv-cancel" data-id="' + r.id + '">إلغاء</button>' +
    '</div></div>';
}

/* =================== البوفيه =================== */

function renderShop() {
  setTopbar('البوفيه', 'اضغط على المنتج لإضافته إلى البيع المباشر', '<button class="btn" data-action="product-new">' + icon('plus', 'ic-sm') + 'منتج جديد</button>');
  $('#view').innerHTML =
    '<div class="shop">' +
      '<section style="min-width:0">' +
        '<div class="filters" id="shop-tools"></div>' +
        '<div id="low-stock"></div>' +
        '<div class="products" id="products"></div>' +
      '</section>' +
      '<aside class="cart"><section class="panel" id="cart"></section></aside>' +
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
  if (p.stock == null) return '<span class="product-stock">بلا عدّ مخزون</span>';
  if (p.stock <= 0) return '<span class="product-stock out">نفد</span>';
  if (p.stock <= 5) return '<span class="product-stock low">بقي ' + p.stock + '</span>';
  return '<span class="product-stock">في المخزون <span class="num">' + p.stock + '</span></span>';
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
    ? '<div class="notice warn" style="margin:0 0 12px"><p><b>أوشك على النفاد:</b> ' + low.map(function (p) { return esc(p.name) + ' (' + p.stock + ')'; }).join('، ') + '</p></div>'
    : '';
  if (!state.products.length) {
    box.innerHTML = '<div class="panel empty" style="grid-column:1/-1"><b>لا توجد منتجات</b><span>أضف المشروبات والسناكات لتبيعها مباشرة أو تضيفها على حساب جلسة.</span>' +
      '<button class="btn btn-primary" data-action="product-new">منتج جديد</button></div>';
    return;
  }
  if (!list.length) {
    box.innerHTML = '<div class="panel empty" style="grid-column:1/-1"><span>لا منتجات تطابق البحث.</span></div>';
    return;
  }
  box.innerHTML = list.map(function (p) {
    const out = p.stock != null && p.stock <= 0;
    return '<div class="product-wrap">' +
      '<button type="button" class="product" data-action="cart-add" data-id="' + p.id + '"' + (out ? ' disabled' : '') + '>' +
        '<span class="product-cat">' + catOf(p).name + '</span>' +
        '<span class="product-name">' + esc(p.name) + '</span>' +
        '<span class="product-price led">' + fmtNum(p.price) + '<small>' + esc(cur()) + '</small></span>' +
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
    '<div class="panel-head"><div><h2 class="panel-title">بيع مباشر</h2><div class="panel-sub">' + (count ? count + ' قطعة' : 'للزبائن من غير جلسة') + '</div></div>' +
      (count ? '<button class="btn btn-sm btn-ghost" data-action="cart-clear">تفريغ</button>' : '') + '</div>' +
    (state.cart.length
      ? '<div class="cart-lines">' + state.cart.map(function (i) {
          return '<div class="cart-line"><div class="item-main"><div class="item-title">' + esc(i.name) + '</div><div class="item-sub num">' + fmtNum(i.price) + ' × ' + i.qty + '</div></div>' +
            '<div class="qty"><button class="btn btn-icon btn-sm" data-action="cart-dec" data-id="' + i.productId + '" aria-label="إنقاص">' + icon('minus', 'ic-sm') + '</button><b>' + i.qty + '</b>' +
            '<button class="btn btn-icon btn-sm" data-action="cart-inc" data-id="' + i.productId + '" aria-label="زيادة">' + icon('plus', 'ic-sm') + '</button></div>' +
            '<b class="num" style="min-width:64px;text-align:end">' + fmtNum(i.price * i.qty) + '</b></div>';
        }).join('') + '</div>' +
        '<div class="sum-rows" style="margin-top:10px"><div class="sum-row total"><span>الإجمالي</span><span>' + fmtNum(total) + '</span></div></div>' +
        '<button class="btn btn-primary btn-lg btn-block" style="margin-top:14px" data-action="cart-checkout">قبض ' + money(total) + '</button>'
      : '<p class="now-empty">السلة فارغة. لإضافة طلب على حساب جهاز استخدم زر البوفيه في بطاقته.</p>');
}
