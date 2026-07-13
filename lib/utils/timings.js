const FALLBACK = {
  startTime: '10:00:00',
  endTime: '19:00:00',
  lateAfterTime: '10:15:00',
};

/**
 * Resolve the timings that apply to a staff member, most specific first:
 * the person's own timings, then the defaults for their role, then a fallback.
 *
 * Only lateAfterTime affects attendance status. startTime and endTime are
 * reference values — leaving before endTime never marks anyone Late.
 */
export function resolveTimings(staff, settings) {
  const roleDefaults = staff?.role === 'Accountant'
    ? {
        startTime: settings?.accountant_start_time,
        endTime: settings?.accountant_end_time,
        lateAfterTime: settings?.accountant_late_after_time,
      }
    : {
        startTime: settings?.office_start_time,
        endTime: settings?.office_end_time,
        lateAfterTime: settings?.late_after_time,
      };

  return {
    startTime: staff?.start_time || roleDefaults.startTime || FALLBACK.startTime,
    endTime: staff?.end_time || roleDefaults.endTime || FALLBACK.endTime,
    lateAfterTime: staff?.late_after_time || roleDefaults.lateAfterTime || FALLBACK.lateAfterTime,
  };
}

/**
 * True when a staff member carries their own timings instead of inheriting.
 */
export function hasCustomTimings(staff) {
  return Boolean(staff?.start_time || staff?.end_time || staff?.late_after_time);
}

/**
 * Postgres TIME columns come back as HH:mm:ss, but <input type="time"> wants HH:mm.
 */
export function toTimeInput(time) {
  if (!time) return '';
  return String(time).slice(0, 5);
}
