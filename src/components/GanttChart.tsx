import { useMemo } from 'react';
import type { Property, Task } from '../types';
import { DEFAULT_TASKS } from '../constants';
import {
  parseDate,
  formatDisplayDate,
  getSlotDates,
  isTaskInSlot,
  getMonthRange,
  addMonths,
} from '../utils/dateUtils';

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const WEEK_LABELS = ['1週', '2週', '3週', '4週'];
const CELL_W = 36;

interface Props {
  property: Property;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
}

export function GanttChart({ property, onUpdateTask }: Props) {
  const today = useMemo(() => new Date(), []);

  const months = useMemo(() => {
    const allDates: Date[] = [];
    for (const t of property.tasks) {
      const s = parseDate(t.startDate);
      const e = parseDate(t.endDate);
      if (s) allDates.push(s);
      if (e) allDates.push(e);
    }

    let from: Date;
    let to: Date;
    if (allDates.length === 0) {
      from = addMonths(today, -1);
      to = addMonths(today, 17);
    } else {
      const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
      from = addMonths(minDate, -1);
      to = addMonths(maxDate, 2);
      // ensure at least 12 months shown
      if (getMonthRange(from, to).length < 12) {
        to = addMonths(from, 11);
      }
    }
    return getMonthRange(from, to);
  }, [property.tasks, today]);

  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();

  function getTodaySlot(): { monthIdx: number; slot: number } | null {
    const idx = months.findIndex(m => m.year === todayYear && m.month === todayMonth);
    if (idx === -1) return null;
    const slot = todayDate < 8 ? 0 : todayDate < 15 ? 1 : todayDate < 22 ? 2 : 3;
    return { monthIdx: idx, slot };
  }
  const todaySlot = getTodaySlot();

  function getTaskColor(taskName: string): string {
    const def = DEFAULT_TASKS.find(d => d.name === taskName);
    return def?.color ?? '#6B7280';
  }

  function isTodayCell(monthIdx: number, slot: number): boolean {
    return todaySlot?.monthIdx === monthIdx && todaySlot?.slot === slot;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Property header */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded font-bold">
            {property.id}
          </span>
          <h1 className="text-xl font-bold text-gray-800">{property.name}</h1>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          登録日: {new Date(property.createdAt).toLocaleDateString('ja-JP')}
        </div>
      </div>

      {/* Gantt table */}
      <div className="flex-1 overflow-auto">
        <div className="inline-flex min-w-full">
          {/* Left: task info (sticky) */}
          <div className="sticky left-0 z-20 bg-white shrink-0 shadow-[2px_0_6px_rgba(0,0,0,0.08)]">
            {/* Header rows */}
            <div className="flex">
              <div className="w-44 border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 flex items-end">
                工程
              </div>
              <div className="w-32 border-b border-r border-gray-200 bg-gray-50 px-2 py-2 text-xs font-semibold text-gray-600 flex items-end">
                開始日
              </div>
              <div className="w-32 border-b border-r border-gray-200 bg-gray-50 px-2 py-2 text-xs font-semibold text-gray-600 flex items-end">
                終了日
              </div>
            </div>
            {/* empty row for week sub-header */}
            <div className="h-7 border-b border-gray-200 bg-gray-50" />

            {/* Task rows */}
            {property.tasks.map(task => {
              const color = getTaskColor(task.name);
              return (
                <div key={task.id} className="flex items-center border-b border-gray-100 h-11">
                  <div
                    className="w-44 px-3 py-2 text-xs font-medium text-gray-700 truncate border-r border-gray-200"
                    title={task.name}
                    style={{ borderLeft: `3px solid ${color}` }}
                  >
                    {task.name}
                  </div>
                  <div className="w-32 px-2 border-r border-gray-200">
                    <input
                      type="date"
                      value={task.startDate ?? ''}
                      onChange={e => onUpdateTask(task.id, { startDate: e.target.value || null })}
                      className="w-full text-xs border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div className="w-32 px-2 border-r border-gray-200">
                    <input
                      type="date"
                      value={task.endDate ?? ''}
                      min={task.startDate ?? undefined}
                      onChange={e => onUpdateTask(task.id, { endDate: e.target.value || null })}
                      className="w-full text-xs border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: timeline grid */}
          <div className="shrink-0">
            {/* Month header */}
            <div className="flex bg-gray-50 border-b border-gray-200">
              {months.map(({ year, month }, mi) => (
                <div
                  key={`${year}-${month}`}
                  style={{ width: CELL_W * 4 }}
                  className={`text-center text-xs font-semibold py-1 border-r border-gray-200 ${
                    year === todayYear && month === todayMonth ? 'text-blue-600 bg-blue-50' : 'text-gray-600'
                  }`}
                >
                  {year !== months[mi - 1]?.year && (
                    <span className="text-gray-400 mr-0.5">{year}/</span>
                  )}
                  {MONTH_NAMES[month]}
                </div>
              ))}
            </div>

            {/* Week sub-header */}
            <div className="flex bg-gray-50 border-b border-gray-200 h-7">
              {months.map(({ year, month }) =>
                WEEK_LABELS.map((label, wi) => (
                  <div
                    key={`${year}-${month}-${wi}`}
                    style={{ width: CELL_W }}
                    className={`text-center text-[10px] text-gray-400 border-r border-gray-100 flex items-center justify-center ${
                      isTodayCell(months.findIndex(m => m.year === year && m.month === month), wi)
                        ? 'bg-blue-100 text-blue-500 font-semibold'
                        : ''
                    }`}
                  >
                    {label}
                  </div>
                ))
              )}
            </div>

            {/* Task rows */}
            {property.tasks.map(task => {
              const taskStart = parseDate(task.startDate);
              const taskEnd = parseDate(task.endDate);
              const color = getTaskColor(task.name);

              return (
                <div key={task.id} className="flex border-b border-gray-100 h-11 items-center">
                  {months.map(({ year, month }, mi) =>
                    [0, 1, 2, 3].map(slot => {
                      const [slotStart, slotEnd] = getSlotDates(year, month, slot);
                      const filled = isTaskInSlot(taskStart, taskEnd, slotStart, slotEnd);
                      const isToday = isTodayCell(mi, slot);

                      return (
                        <div
                          key={`${year}-${month}-${slot}`}
                          style={{
                            width: CELL_W,
                            backgroundColor: filled ? color : isToday ? '#EFF6FF' : undefined,
                            opacity: filled ? 0.85 : 1,
                          }}
                          className={`h-6 mx-px rounded-sm border-r border-gray-100 ${
                            !filled && isToday ? 'border-blue-200' : ''
                          }`}
                          title={
                            filled
                              ? `${task.name}: ${formatDisplayDate(task.startDate)} 〜 ${formatDisplayDate(task.endDate)}`
                              : undefined
                          }
                        />
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex flex-wrap gap-3 shrink-0">
        {DEFAULT_TASKS.map(t => (
          <div key={t.name} className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: t.color }} />
            <span className="text-xs text-gray-500">{t.name}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-4">
          <div className="w-4 h-3 rounded-sm bg-blue-100 border border-blue-200" />
          <span className="text-xs text-gray-500">今日</span>
        </div>
      </div>
    </div>
  );
}
