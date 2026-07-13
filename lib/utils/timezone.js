import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { differenceInMinutes, parse } from 'date-fns';

const TIMEZONE = 'Asia/Kolkata';

/**
 * Get current date and time in IST
 */
export function getISTNow() {
  return toZonedTime(new Date(), TIMEZONE);
}

/**
 * Get today's date in IST as YYYY-MM-DD string
 */
export function getISTDateString() {
  return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Format a Date object to IST date string (YYYY-MM-DD)
 */
export function formatISTDate(date) {
  return formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Format a Date object to IST time string (HH:mm:ss)
 */
export function formatISTTime(date) {
  return formatInTimeZone(date, TIMEZONE, 'HH:mm:ss');
}

/**
 * Format a Date to display-friendly IST time (h:mm a)
 */
export function formatISTTimeDisplay(date) {
  if (!date) return '-';
  return formatInTimeZone(new Date(date), TIMEZONE, 'h:mm a');
}

/**
 * Format a Date to display-friendly IST date (d MMMM yyyy)
 */
export function formatISTDateDisplay(date) {
  if (!date) return '-';
  return formatInTimeZone(new Date(date), TIMEZONE, 'd MMMM yyyy');
}

/**
 * Get current IST time as HH:mm string for comparison with office times
 */
export function getISTTimeString() {
  return formatInTimeZone(new Date(), TIMEZONE, 'HH:mm');
}

/**
 * Calculate total hours between two timestamps
 * Returns string like "9h 10m"
 */
export function calculateTotalHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return null;
  const minutes = differenceInMinutes(new Date(checkOut), new Date(checkIn));
  if (minutes < 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

/**
 * Pad a time to HH:mm:ss so values can be compared as strings. Accepts both
 * HH:mm (from <input type="time">) and HH:mm:ss (from Postgres TIME columns).
 */
function toHHMMSS(time) {
  const [h = '00', m = '00', s = '00'] = String(time).split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`;
}

/**
 * Check if a check-in timestamp is after the late threshold.
 * Only ever called with the check-in time — checking out early is not late.
 */
export function isLate(checkInTime, lateAfterTime) {
  if (!checkInTime || !lateAfterTime) return false;
  const checkInIST = formatInTimeZone(new Date(checkInTime), TIMEZONE, 'HH:mm:ss');
  return checkInIST > toHHMMSS(lateAfterTime);
}

/**
 * Format date for display: "2 July 2026"
 */
export function formatDateForDisplay(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T00:00:00');
  return formatInTimeZone(date, TIMEZONE, 'd MMMM yyyy');
}

/**
 * Get all dates between two dates (inclusive)
 */
export function getDateRange(fromDate, toDate) {
  const dates = [];
  const current = new Date(fromDate);
  const end = new Date(toDate);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
