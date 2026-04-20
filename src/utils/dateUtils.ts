export function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDisplayDate(dateStr: string | null): string {
  if (!dateStr) return '―';
  const [y, m, d] = dateStr.split('-');
  return `${y}/${m}/${d}`;
}

/** week slot 0-3 within a month → [slotStart, slotEnd] */
export function getSlotDates(year: number, month: number, slot: number): [Date, Date] {
  const starts = [1, 8, 15, 22];
  const slotStart = new Date(year, month, starts[slot]);
  const slotEnd =
    slot === 3
      ? new Date(year, month + 1, 0)
      : new Date(year, month, starts[slot + 1] - 1);
  return [slotStart, slotEnd];
}

export function isTaskInSlot(
  taskStart: Date | null,
  taskEnd: Date | null,
  slotStart: Date,
  slotEnd: Date
): boolean {
  if (!taskStart || !taskEnd) return false;
  return taskStart <= slotEnd && taskEnd >= slotStart;
}

/** Returns array of {year, month} covering the given range (inclusive) */
export function getMonthRange(from: Date, to: Date): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cur <= end) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() });
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

export function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}
