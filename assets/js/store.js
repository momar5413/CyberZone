/* CyberZone — البيانات: الحالة الافتراضية، الحفظ في المتصفح، والبيانات التجريبية */
'use strict';

const STORAGE_KEY = 'cyberzone.v2';
const SCHEMA_VERSION = 2;

const TYPE_ICONS = { monitor: 'monitor', gamepad: 'gamepad', glasses: 'glasses', tv: 'tv' };

function defaultSettings() {
  return {
    centerName: 'CyberZone',
    currency: 'ل.س',
    receiptFooter: 'شكراً لزيارتكم — نراكم قريباً',
    step: 5,            // وحدة الحساب بالدقائق
    grace: 1,           // فترة السماح بالدقائق
    minMinutes: 15,     // الحد الأدنى للجلسة
    roundTo: 500,       // تقريب أجرة الوقت
    roundMode: 'nearest',
    warnMinutes: 5,     // التنبيه قبل انتهاء الوقت
    holdMinutes: 15,    // مهلة انتظار صاحب الحجز
    sound: true,
    notify: false,
    theme: 'dark'
  };
}

function defaultTypes() {
  return [
    { id: 'ps5', name: 'PlayStation 5', icon: 'gamepad', rate: 25000, rateMulti: 35000 },
    { id: 'ps4', name: 'PlayStation 4', icon: 'gamepad', rate: 15000, rateMulti: 20000 },
    { id: 'xbox', name: 'Xbox Series X', icon: 'gamepad', rate: 20000, rateMulti: 30000 },
    { id: 'pc', name: 'كمبيوتر PC', icon: 'monitor', rate: 12000, rateMulti: null },
    { id: 'vr', name: 'نظارة VR', icon: 'glasses', rate: 40000, rateMulti: null }
  ];
}

function defaultProducts() {
  return [
    { id: 'p-water', name: 'مياه معدنية', category: 'cold', price: 3000, stock: 48 },
    { id: 'p-pepsi', name: 'بيبسي', category: 'cold', price: 7000, stock: 36 },
    { id: 'p-mirinda', name: 'ميرندا', category: 'cold', price: 7000, stock: 24 },
    { id: 'p-redbull', name: 'ريد بول', category: 'cold', price: 18000, stock: 4 },
    { id: 'p-juice', name: 'عصير برتقال', category: 'cold', price: 9000, stock: 18 },
    { id: 'p-tea', name: 'شاي', category: 'hot', price: 5000, stock: null },
    { id: 'p-coffee', name: 'قهوة', category: 'hot', price: 8000, stock: null },
    { id: 'p-nescafe', name: 'نسكافيه', category: 'hot', price: 8000, stock: null },
    { id: 'p-chips', name: 'شيبس', category: 'snack', price: 6000, stock: 30 },
    { id: 'p-biscuit', name: 'بسكويت', category: 'snack', price: 4000, stock: 40 },
    { id: 'p-croissant', name: 'كرواسان', category: 'snack', price: 7000, stock: 12 },
    { id: 'p-noodles', name: 'إندومي', category: 'meal', price: 12000, stock: 20 },
    { id: 'p-sandwich', name: 'سندويشة فلافل', category: 'meal', price: 15000, stock: null }
  ];
}

const PRODUCT_CATEGORIES = [
  { id: 'cold', name: 'مشروبات باردة', icon: 'cup' },
  { id: 'hot', name: 'مشروبات ساخنة', icon: 'coffee' },
  { id: 'snack', name: 'سناكات', icon: 'cookie' },
  { id: 'meal', name: 'وجبات', icon: 'store' }
];

function emptyState() {
  return {
    version: SCHEMA_VERSION,
    meta: { demo: false, createdAt: Date.now(), receiptSeq: 1000 },
    settings: defaultSettings(),
    types: defaultTypes(),
    devices: [],
    sessions: [],
    products: defaultProducts(),
    reservations: [],
    history: [],
    cart: []
  };
}

/* ---------- الحفظ والتحميل ---------- */

const storage = {
  ok: true,
  read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      this.ok = false;
      return null;
    }
  },
  write(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      this.ok = true;
      return true;
    } catch (e) {
      this.ok = false;
      return false;
    }
  },
  clear() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* غير متاح */ }
  }
};

// إكمال أي حقول ناقصة (نسخ أقدم أو نسخة احتياطية مستوردة)
function normalizeState(s) {
  const base = emptyState();
  if (!s || typeof s !== 'object') return base;
  const out = Object.assign({}, base, s);
  out.version = SCHEMA_VERSION;
  out.meta = Object.assign({}, base.meta, s.meta);
  out.settings = Object.assign({}, base.settings, s.settings);
  ['types', 'devices', 'sessions', 'products', 'reservations', 'history', 'cart'].forEach(function (k) {
    if (!Array.isArray(out[k])) out[k] = base[k];
  });
  out.sessions.forEach(function (x) {
    if (!Array.isArray(x.segments)) x.segments = [];
    if (!Array.isArray(x.items)) x.items = [];
  });
  return out;
}

function isValidBackup(s) {
  return s && typeof s === 'object' && Array.isArray(s.devices) && Array.isArray(s.history) && s.settings;
}

/* ---------- البيانات التجريبية ---------- */

const DEMO_NAMES = ['محمد', 'أحمد', 'علي', 'يوسف', 'عمر', 'خالد', 'حسن', 'سامر', 'مجد', 'ليث', 'كريم', 'رامي', 'باسل', 'طارق', 'زيد', 'فراس', 'نور', 'جود', 'وسيم', 'حمزة', 'آدم', 'مهند', 'قصي', 'أنس'];

function demoDevices() {
  return [
    { id: 'd-ps5-1', name: 'PS5 · 1', typeId: 'ps5' },
    { id: 'd-ps5-2', name: 'PS5 · 2', typeId: 'ps5' },
    { id: 'd-ps5-3', name: 'PS5 · 3', typeId: 'ps5' },
    { id: 'd-ps5-vip', name: 'PS5 · غرفة VIP', typeId: 'ps5', rate: 40000, rateMulti: 50000, note: 'شاشة 75 إنش' },
    { id: 'd-ps4-1', name: 'PS4 · 1', typeId: 'ps4' },
    { id: 'd-ps4-2', name: 'PS4 · 2', typeId: 'ps4' },
    { id: 'd-xbox-1', name: 'Xbox · 1', typeId: 'xbox' },
    { id: 'd-pc-1', name: 'PC · 1', typeId: 'pc' },
    { id: 'd-pc-2', name: 'PC · 2', typeId: 'pc' },
    { id: 'd-pc-3', name: 'PC · 3', typeId: 'pc' },
    { id: 'd-vr-1', name: 'VR · Quest 3', typeId: 'vr', maintenance: true, note: 'بانتظار استبدال يد التحكم' }
  ].map(function (d) {
    return Object.assign({ rate: null, rateMulti: null, maintenance: false, note: '' }, d);
  });
}

function buildDemoState(now) {
  const s = emptyState();
  s.meta.demo = true;
  s.devices = demoDevices();
  const rnd = seededRandom(20260930);
  const pick = function (arr) { return arr[Math.floor(rnd() * arr.length)]; };
  const MIN = Billing.MIN;
  const rules = s.settings;

  const rateFor = function (d, mode) {
    const t = s.types.find(function (x) { return x.id === d.typeId; });
    if (mode === 'multi') return d.rateMulti || t.rateMulti || d.rate || t.rate;
    return d.rate || t.rate;
  };

  // سجل الأيام السابقة
  const hourWeights = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 3, 4, 5, 7, 8, 9, 10, 9, 7, 4, 2];
  const weightSum = hourWeights.reduce(function (a, b) { return a + b; }, 0);
  const pickHour = function () {
    let r = rnd() * weightSum;
    for (let h = 0; h < 24; h++) { r -= hourWeights[h]; if (r <= 0) return h; }
    return 20;
  };
  const playable = s.devices.filter(function (d) { return d.typeId !== 'vr'; });
  const records = [];
  const today0 = startOfDay(now);

  for (let back = 30; back >= 0; back--) {
    const day0 = addDays(today0, -back);
    const weekday = new Date(day0).getDay();
    const weekend = weekday === 5 || weekday === 4; // الخميس والجمعة أكثر ازدحاماً
    let count = Math.round((weekend ? 20 : 12) + rnd() * 8 + (30 - back) * 0.15);
    if (back === 0) count = Math.max(0, Math.round(count * clamp((now - day0) / DAY_MS - 0.35, 0, 1)));
    for (let i = 0; i < count; i++) {
      const hour = pickHour();
      const start = day0 + hour * 3600000 + Math.floor(rnd() * 60) * MIN;
      const dur = Math.round(20 + rnd() * rnd() * 170) * MIN + Math.floor(rnd() * 60) * 1000;
      const end = start + dur;
      if (end > now - 5 * MIN) continue;
      const d = pick(playable);
      const t = s.types.find(function (x) { return x.id === d.typeId; });
      const mode = t.rateMulti && rnd() < 0.45 ? 'multi' : 'single';
      const rate = rateFor(d, mode);
      const fixed = rnd() < 0.4 ? pick([30, 60, 60, 90, 120]) : null;
      const sess = { rate: rate, segments: [{ rate: rate, ms: dur }], runSince: null, plannedMin: fixed };
      const charge = Billing.timeCharge(sess, end, rules);
      const items = [];
      const nItems = rnd() < 0.55 ? 1 + Math.floor(rnd() * 3) : 0;
      for (let k = 0; k < nItems; k++) {
        const p = pick(s.products);
        const ex = items.find(function (x) { return x.productId === p.id; });
        if (ex) ex.qty++;
        else items.push({ productId: p.id, name: p.name, price: p.price, qty: 1 });
      }
      const itemsAmount = Billing.itemsTotal(items);
      const discount = rnd() < 0.08 ? Billing.roundMoney((charge.amount + itemsAmount) * 0.1, 500, 'nearest') : 0;
      const total = charge.amount + itemsAmount - discount;
      records.push({
        id: uid() + i,
        kind: 'session',
        deviceId: d.id,
        deviceName: d.name,
        typeName: t.name,
        player: pick(DEMO_NAMES),
        phone: '',
        mode: mode,
        plannedMin: fixed,
        startedAt: start,
        endedAt: end,
        playedMs: dur,
        billedMinutes: charge.minutes,
        avgRate: charge.avgRate,
        timeAmount: charge.amount,
        items: items,
        itemsAmount: itemsAmount,
        discount: discount,
        total: total,
        paid: total,
        method: rnd() < 0.8 ? 'cash' : 'card',
        note: ''
      });
    }
    // مبيعات مباشرة من البوفيه
    const sales = Math.floor(rnd() * 5);
    for (let j = 0; j < sales; j++) {
      const at = day0 + pickHour() * 3600000 + Math.floor(rnd() * 60) * MIN;
      if (at > now - 5 * MIN) continue;
      const p = pick(s.products);
      const qty = 1 + Math.floor(rnd() * 2);
      const amt = p.price * qty;
      records.push({
        id: uid() + 's' + j, kind: 'sale', deviceId: null, deviceName: 'بيع مباشر', typeName: '',
        player: '', phone: '', mode: null, plannedMin: null, startedAt: at, endedAt: at, playedMs: 0,
        billedMinutes: 0, avgRate: 0, timeAmount: 0,
        items: [{ productId: p.id, name: p.name, price: p.price, qty: qty }],
        itemsAmount: amt, discount: 0, total: amt, paid: amt, method: 'cash', note: ''
      });
    }
  }
  records.sort(function (a, b) { return a.endedAt - b.endedAt; });
  records.forEach(function (r) { r.no = ++s.meta.receiptSeq; });
  s.history = records;

  // جلسات جارية الآن بحالات مختلفة
  const mk = function (deviceId, o) {
    const d = s.devices.find(function (x) { return x.id === deviceId; });
    const rate = rateFor(d, o.mode || 'single');
    const started = now - o.agoMin * MIN - 17000;
    const sess = {
      id: uid() + deviceId,
      deviceId: deviceId,
      player: o.player,
      phone: o.phone || '',
      mode: o.mode || 'single',
      rate: rate,
      plannedMin: o.planned || null,
      startedAt: started,
      segments: [],
      runSince: started,
      items: (o.items || []).map(function (x) {
        const p = s.products.find(function (pp) { return pp.id === x[0]; });
        return { productId: p.id, name: p.name, price: p.price, qty: x[1] };
      }),
      warned: true,
      overAlerted: true,
      reservationId: null
    };
    if (o.pausedMin) {
      Billing.pause(sess, now - o.pausedMin * MIN);
    }
    s.sessions.push(sess);
  };
  mk('d-ps5-1', { player: 'فريق مجد', mode: 'multi', agoMin: 47, items: [['p-pepsi', 2], ['p-chips', 1]] });
  mk('d-ps5-2', { player: 'يوسف', agoMin: 56, planned: 60, items: [['p-redbull', 1]] });
  mk('d-ps5-3', { player: 'عمر', mode: 'multi', agoMin: 33, planned: 30 });
  mk('d-ps4-2', { player: 'حسن', agoMin: 38, planned: 120, items: [['p-tea', 1]] });
  mk('d-pc-1', { player: 'ليث', agoMin: 72, items: [['p-coffee', 1], ['p-biscuit', 2]] });
  mk('d-pc-3', { player: 'كريم', agoMin: 25, pausedMin: 6 });

  // حجوزات قادمة
  const in30 = Math.ceil((now + 40 * MIN) / (15 * MIN)) * 15 * MIN;
  s.reservations = [
    { id: uid() + 'r1', name: 'باسل وأصدقاؤه', phone: '0933 123 456', deviceId: 'd-ps5-vip', start: in30, minutes: 120, note: 'بطولة FC 26', status: 'booked', createdAt: now - 3 * 3600000 },
    { id: uid() + 'r2', name: 'طارق', phone: '0944 555 210', deviceId: 'd-xbox-1', start: in30 + 90 * MIN, minutes: 60, note: '', status: 'booked', createdAt: now - 3600000 },
    { id: uid() + 'r3', name: 'زيد', phone: '', deviceId: 'd-ps5-2', start: addDays(startOfDay(now), 1) + 18 * 3600000, minutes: 90, note: '', status: 'booked', createdAt: now - 7200000 },
    { id: uid() + 'r4', name: 'فراس', phone: '0955 000 777', deviceId: 'd-pc-2', start: now - 26 * 3600000, minutes: 60, note: '', status: 'done', createdAt: now - 50 * 3600000 },
    { id: uid() + 'r5', name: 'نور', phone: '', deviceId: 'd-ps4-1', start: now - 22 * 3600000, minutes: 60, note: '', status: 'noshow', createdAt: now - 30 * 3600000 }
  ];
  return s;
}

// تفريغ العمليات مع إبقاء الأجهزة والمنتجات والإعدادات
function clearOperations(s) {
  s.sessions = [];
  s.history = [];
  s.reservations = [];
  s.cart = [];
  s.meta.demo = false;
  s.meta.receiptSeq = 1000;
  s.devices.forEach(function (d) { d.maintenance = false; d.note = ''; });
  return s;
}
