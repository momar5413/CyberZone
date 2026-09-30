/*
 * CyberZone — محرّك الحساب
 * دوال نقية لحساب مدة الجلسة وتكلفتها. لا تعتمد على الواجهة، وتعمل في المتصفح وفي Node للاختبار.
 *
 * شكل الجلسة المستخدم هنا:
 *   rate        السعر الحالي للساعة
 *   segments    [{ rate, ms }] فترات لعب مغلقة (عند الإيقاف المؤقت أو تغيير السعر)
 *   runSince    توقيت بدء الفترة الجارية، أو null إن كانت الجلسة موقوفة مؤقتاً
 *   plannedMin  المدة المحجوزة بالدقائق، أو null للوقت المفتوح
 */
(function (root) {
  'use strict';

  var MIN = 60000;
  var HOUR = 3600000;

  function elapsedMs(s, now) {
    var ms = 0;
    for (var i = 0; i < s.segments.length; i++) ms += s.segments[i].ms;
    if (s.runSince != null) ms += Math.max(0, now - s.runSince);
    return ms;
  }

  // تكلفة الوقت الفعلي قبل أي تقريب، مع مراعاة تغيّر السعر بين الفترات
  function rawCost(s, now) {
    var c = 0;
    for (var i = 0; i < s.segments.length; i++) c += s.segments[i].rate * s.segments[i].ms / HOUR;
    if (s.runSince != null) c += s.rate * Math.max(0, now - s.runSince) / HOUR;
    return c;
  }

  /*
   * الدقائق المحتسبة:
   * - تُقرَّب لأعلى إلى وحدة الحساب (step)
   * - يُتجاوز عن التخطي البسيط لحدّ الوحدة ضمن فترة السماح (grace)
   * - لا تقل عن المدة المحجوزة (إن وُجدت) ولا عن الحد الأدنى للجلسة
   */
  function billableMinutes(ms, rules, plannedMin) {
    var actual = ms / MIN;
    var step = Math.max(1, Number(rules.step) || 1);
    var grace = Math.max(0, Number(rules.grace) || 0);
    var steps = Math.ceil(actual / step - 1e-9);
    if (steps > 0 && actual - (steps - 1) * step <= grace) steps -= 1;
    var billed = steps * step;
    if (plannedMin) billed = Math.max(billed, plannedMin);
    billed = Math.max(billed, Number(rules.minMinutes) || 0);
    return billed;
  }

  function roundMoney(amount, to, mode) {
    to = Number(to) || 0;
    if (to <= 0) return Math.round(amount);
    var q = amount / to;
    return (mode === 'up' ? Math.ceil(q - 1e-9) : Math.round(q)) * to;
  }

  /*
   * حساب أجرة الوقت.
   * opts.ignorePlanned: احتساب الوقت الفعلي فقط حتى لو كانت الجلسة محجوزة بمدة أطول.
   */
  function timeCharge(s, now, rules, opts) {
    opts = opts || {};
    var ms = elapsedMs(s, now);
    var planned = opts.ignorePlanned ? null : s.plannedMin;
    var minutes = billableMinutes(ms, rules, planned);
    var avgRate = ms > 0 ? rawCost(s, now) / (ms / HOUR) : s.rate;
    var amount = minutes > 0 ? roundMoney(avgRate * minutes / 60, rules.roundTo, rules.roundMode) : 0;
    return { ms: ms, minutes: minutes, avgRate: avgRate, amount: amount };
  }

  function itemsTotal(items) {
    var t = 0;
    for (var i = 0; i < items.length; i++) t += items[i].price * items[i].qty;
    return t;
  }

  function remainingMs(s, now) {
    if (!s.plannedMin) return null;
    return s.plannedMin * MIN - elapsedMs(s, now);
  }

  // حالة الجلسة: open | running | warn | over | paused
  function phase(s, now, warnMin) {
    if (s.runSince == null) return 'paused';
    if (!s.plannedMin) return 'open';
    var rem = remainingMs(s, now);
    if (rem <= 0) return 'over';
    if (rem <= (warnMin || 0) * MIN) return 'warn';
    return 'running';
  }

  function pushSegment(s, rate, ms) {
    if (ms <= 0) return;
    var last = s.segments[s.segments.length - 1];
    if (last && last.rate === rate) last.ms += ms;
    else s.segments.push({ rate: rate, ms: ms });
  }

  function pause(s, now) {
    if (s.runSince == null) return;
    pushSegment(s, s.rate, now - s.runSince);
    s.runSince = null;
  }

  function resume(s, now) {
    if (s.runSince != null) return;
    s.runSince = now;
  }

  // تغيير السعر (تبديل فردي/زوجي أو نقل لجهاز آخر) دون المساس بالوقت السابق
  function changeRate(s, rate, now) {
    if (s.runSince != null) {
      pushSegment(s, s.rate, now - s.runSince);
      s.runSince = now;
    }
    s.rate = rate;
  }

  var api = {
    MIN: MIN,
    HOUR: HOUR,
    elapsedMs: elapsedMs,
    rawCost: rawCost,
    billableMinutes: billableMinutes,
    roundMoney: roundMoney,
    timeCharge: timeCharge,
    itemsTotal: itemsTotal,
    remainingMs: remainingMs,
    phase: phase,
    pause: pause,
    resume: resume,
    changeRate: changeRate
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Billing = api;
})(typeof window !== 'undefined' ? window : this);
