'use strict';

const MINUTES_IN_DAY = 1440;
const DEFAULT_SETTINGS = Object.freeze({
  enabled: false,
  workMinutes: 30,
  breakMinutes: 5,
  quietEnabled: true,
  quietStart: '22:00',
  quietEnd: '09:00',
});

function parseClock(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatClock(value) {
  const n = ((value % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

function isActiveAt(date, settings) {
  if (!settings.quietEnabled) return true;
  const quietStart = parseClock(settings.quietStart);
  const quietEnd = parseClock(settings.quietEnd);
  if (quietStart === null || quietEnd === null || quietStart === quietEnd) return false;
  const minute = date.getHours() * 60 + date.getMinutes();
  if (quietStart > quietEnd) return minute >= quietEnd && minute < quietStart;
  return minute >= quietEnd || minute < quietStart;
}

// Repeating DAILY calendar notifications are registered ONLY for active hours.
// This lets the phone enforce quiet hours, even while the app is terminated.
function buildDailySlots(settings) {
  const work = Number(settings.workMinutes);
  const pause = Number(settings.breakMinutes);
  if (![30, 45, 60].includes(work) || ![5, 10].includes(pause)) {
    throw new Error('Geçersiz çalışma veya mola süresi.');
  }
  const period = work + pause;
  let anchor = 0;
  let duration = MINUTES_IN_DAY;
  if (settings.quietEnabled) {
    const start = parseClock(settings.quietStart);
    const end = parseClock(settings.quietEnd);
    if (start === null || end === null || start === end) {
      throw new Error('Sessiz saatler farklı ve SS:DD biçiminde olmalı.');
    }
    anchor = end;
    duration = (start - end + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    if (duration < work) throw new Error('Bildirimler için daha uzun bir zaman aralığı seç.');
  }
  const slots = [];
  for (let t = work; t < duration; t += period) {
    slots.push((anchor + t) % MINUTES_IN_DAY);
  }
  return slots.sort((a, b) => a - b);
}

function nextSlot(slots, now = new Date()) {
  if (!slots || slots.length === 0) return null;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (const slot of slots) {
    const when = new Date(today.getTime());
    when.setHours(Math.floor(slot / 60), slot % 60, 0, 0);
    if (when.getTime() > now.getTime()) return when;
  }
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const first = slots[0];
  tomorrow.setHours(Math.floor(first / 60), first % 60, 0, 0);
  return tomorrow;
}

function dateKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function mmss(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(seconds / 60);
  return `${String(m).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function shouldNotifyBreakEnd(end, settings, now = new Date()) {
  const when = new Date(end);
  return Boolean(settings.enabled) &&
    Number.isFinite(when.getTime()) &&
    when.getTime() > now.getTime() &&
    isActiveAt(when, settings);
}

module.exports = { DEFAULT_SETTINGS, parseClock, formatClock, isActiveAt, buildDailySlots, nextSlot, dateKey, mmss, shouldNotifyBreakEnd };
