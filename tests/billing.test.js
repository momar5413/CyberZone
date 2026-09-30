// تشغيل: npm test  (أو node --test tests/)
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../assets/js/billing.js');

const MIN = 60000;
const T0 = Date.UTC(2026, 0, 1, 12, 0, 0);
const rules = { step: 5, grace: 1, minMinutes: 15, roundTo: 500, roundMode: 'nearest' };

function session(extra) {
  return Object.assign({ rate: 24000, segments: [], runSince: T0, plannedMin: null }, extra);
}

test('open session rounds up to the billing step', () => {
  const s = session();
  const r = B.timeCharge(s, T0 + 47 * MIN, rules);
  assert.equal(r.minutes, 50);
  assert.equal(r.amount, 20000);
});

test('grace forgives a small overshoot past a step boundary', () => {
  const s = session();
  assert.equal(B.timeCharge(s, T0 + 45 * MIN + 50000, rules).minutes, 45);
  assert.equal(B.timeCharge(s, T0 + 46 * MIN + 30000, rules).minutes, 50);
});

test('minimum charge applies to very short sessions', () => {
  const s = session();
  const r = B.timeCharge(s, T0 + 2 * MIN, rules);
  assert.equal(r.minutes, 15);
  assert.equal(r.amount, 6000);
});

test('fixed session bills at least the planned time unless told otherwise', () => {
  const s = session({ plannedMin: 60 });
  assert.equal(B.timeCharge(s, T0 + 20 * MIN, rules).minutes, 60);
  assert.equal(B.timeCharge(s, T0 + 20 * MIN, rules, { ignorePlanned: true }).minutes, 20);
  assert.equal(B.timeCharge(s, T0 + 73 * MIN, rules).minutes, 75);
});

test('pause stops the clock and the countdown', () => {
  const s = session({ plannedMin: 30 });
  B.pause(s, T0 + 10 * MIN);
  assert.equal(B.elapsedMs(s, T0 + 40 * MIN), 10 * MIN);
  assert.equal(B.phase(s, T0 + 40 * MIN, 5), 'paused');
  B.resume(s, T0 + 40 * MIN);
  assert.equal(B.remainingMs(s, T0 + 55 * MIN), 5 * MIN);
  assert.equal(B.phase(s, T0 + 55 * MIN, 5), 'warn');
  assert.equal(B.phase(s, T0 + 61 * MIN, 5), 'over');
});

test('rate change mid-session bills each part at its own rate', () => {
  const s = session({ rate: 12000 });
  B.changeRate(s, 36000, T0 + 30 * MIN);
  const r = B.timeCharge(s, T0 + 60 * MIN, Object.assign({}, rules, { roundTo: 0 }));
  // 30 min at 12,000/h + 30 min at 36,000/h
  assert.equal(r.amount, 6000 + 18000);
  assert.equal(r.avgRate, 24000);
});

test('money rounding supports nearest and up', () => {
  assert.equal(B.roundMoney(7083, 500, 'nearest'), 7000);
  assert.equal(B.roundMoney(7083, 500, 'up'), 7500);
  assert.equal(B.roundMoney(7000, 500, 'up'), 7000);
  assert.equal(B.roundMoney(7083.4, 0), 7083);
});

test('items total sums price times quantity', () => {
  assert.equal(B.itemsTotal([{ price: 7000, qty: 2 }, { price: 3000, qty: 1 }]), 17000);
});
