/* CyberZone — أدوات عامة: تنسيق الأرقام والوقت والتواريخ، والحماية من حقن HTML */
'use strict';

const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAY_MS = 86400000;

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

function num(v, fallback) {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : (fallback === undefined ? 0 : fallback);
}

function fmtNum(n) {
  return Math.round(n || 0).toLocaleString('en-US');
}

function fmtCompact(n) {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return String(Math.round(n));
}

function pad2(n) { return String(n).padStart(2, '0'); }

// 1:05:09 أو 05:09
function fmtClockDur(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return (h > 0 ? h + ':' + pad2(m) : pad2(m)) + ':' + pad2(s);
}

// "1 س 20 د" — لعرض المدد في النصوص والتقارير
function fmtDur(ms) {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h && m) return h + ' س ' + m + ' د';
  if (h) return h + ' س';
  return m + ' د';
}

function fmtMinutes(min) { return fmtDur(min * 60000); }

function fmtTime(ts) {
  const d = new Date(ts);
  let h = d.getHours();
  const suffix = h < 12 ? 'ص' : 'م';
  h = h % 12 || 12;
  return h + ':' + pad2(d.getMinutes()) + ' ' + suffix;
}

function fmtDate(ts, withWeekday) {
  const d = new Date(ts);
  const base = d.getDate() + ' ' + MONTHS[d.getMonth()];
  return withWeekday ? WEEKDAYS[d.getDay()] + ' ' + base : base;
}

function fmtDateFull(ts) {
  const d = new Date(ts);
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}

function fmtDateNumeric(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '/' + pad2(d.getMonth() + 1) + '/' + pad2(d.getDate());
}

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function addDays(ts, n) {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

function dayKey(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function parseDayKey(key) {
  const p = String(key).split('-').map(Number);
  if (p.length !== 3 || p.some(isNaN)) return null;
  return new Date(p[0], p[1] - 1, p[2]).getTime();
}

function relativeDay(ts, now) {
  const diff = Math.round((startOfDay(ts) - startOfDay(now)) / DAY_MS);
  if (diff === 0) return 'اليوم';
  if (diff === 1) return 'غداً';
  if (diff === -1) return 'أمس';
  return fmtDate(ts, true);
}

// قيمة لحقل datetime-local بالتوقيت المحلي
function toLocalInput(ts) {
  const d = new Date(ts);
  return dayKey(ts) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function fromLocalInput(v) {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

function debounce(fn, ms) {
  let t;
  return function () {
    const args = arguments;
    clearTimeout(t);
    t = setTimeout(function () { fn.apply(null, args); }, ms);
  };
}

function isFramed() {
  try { return window.self !== window.top; } catch (e) { return true; }
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// مولّد أرقام شبه عشوائية ثابت (للبيانات التجريبية)
function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// عزل الأسماء المختلطة (عربي/لاتيني/أرقام) حتى لا يعيد المتصفح ترتيبها داخل النص العربي
function bdi(v) {
  return '<bdi>' + esc(v) + '</bdi>';
}
