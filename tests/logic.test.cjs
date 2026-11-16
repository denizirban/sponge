const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_SETTINGS, parseClock, buildDailySlots, nextSlot, isActiveAt, formatClock, mmss, shouldNotifyBreakEnd } = require('../src/logic.cjs');

test('Gece sessiz modu 22:00–09:00 arasını otomatik dışlar', () => {
  const s = { ...DEFAULT_SETTINGS, enabled: true };
  const slots = buildDailySlots(s);
  assert.ok(slots.length > 10);
  for (const minute of slots) {
    assert.ok(minute >= 540 && minute < 1320, formatClock(minute));
  }
  assert.equal(formatClock(slots[0]), '09:30');
  assert.equal(formatClock(slots[1]), '10:05');
});

test('Gece sessiz kapalıysa gün boyu döngü vardır ve 64 limitini aşmaz', () => {
  const slots = buildDailySlots({ ...DEFAULT_SETTINGS, quietEnabled: false });
  assert.equal(slots[0], 30);
  assert.equal(slots[1], 65);
  assert.ok(slots.length < 64);
});

test('Saat doğrulama geçersiz biçimleri reddeder', () => {
  assert.equal(parseClock('24:00'), null);
  assert.equal(parseClock('21:75'), null);
  assert.equal(parseClock('09:03'), 543);
  assert.equal(parseClock('9:03'), null);
});

test('Aynı sessiz başlangıcı ve bitişi reddedilir', () => {
  assert.throws(() => buildDailySlots({ ...DEFAULT_SETTINGS, quietStart: '10:00', quietEnd: '10:00' }));
});

test('Normal saatler ve geceyi aşan çalışma aralığı desteklenir', () => {
  const s = { ...DEFAULT_SETTINGS, quietStart: '06:00', quietEnd: '23:00' };
  const slots = buildDailySlots(s);
  assert.equal(formatClock(slots[0]), '00:05');
  assert.ok(slots.some(m => m === 23*60+30));
  assert.equal(isActiveAt(new Date(2026, 10, 16, 2, 0), s), true);
  assert.equal(isActiveAt(new Date(2026, 10, 16, 9, 0), s), false);
});

test('Bir sonraki hatırlatmayı bugün veya yarın bulur', () => {
  const slots = buildDailySlots(DEFAULT_SETTINGS);
  assert.equal(nextSlot(slots, new Date(2026, 10, 16, 9, 31)).getHours(), 10);
  const tomorrow = nextSlot(slots, new Date(2026, 10, 16, 22, 0));
  assert.equal(tomorrow.getDate(), 17);
  assert.equal(tomorrow.getHours(), 9);
  assert.equal(tomorrow.getMinutes(), 30);
});

test('Sayaç pozitif ve negatif sürelerde düzgün biçimlenir', () => {
  assert.equal(mmss(59000), '00:59');
  assert.equal(mmss(-1000), '00:00');
});

test('Mola bitiş bildirimi yalnızca aktif saatlerde ve gelecekte planlanır', () => {
  const settings = { ...DEFAULT_SETTINGS, enabled: true };
  const now = new Date(2026, 10, 16, 10, 0);
  assert.equal(shouldNotifyBreakEnd(new Date(2026, 10, 16, 10, 5), settings, now), true);
  assert.equal(shouldNotifyBreakEnd(new Date(2026, 10, 16, 22, 4), settings, now), false);
  assert.equal(shouldNotifyBreakEnd(new Date(2026, 10, 16, 9, 59), settings, now), false);
  assert.equal(shouldNotifyBreakEnd('invalid', settings, now), false);
  assert.equal(shouldNotifyBreakEnd(new Date(2026, 10, 16, 10, 5), { ...settings, enabled: false }, now), false);
  assert.equal(shouldNotifyBreakEnd(new Date(2026, 10, 16, 22, 4), { ...settings, quietEnabled: false }, now), true);
});
