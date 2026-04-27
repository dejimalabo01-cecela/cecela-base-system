import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faSearch, faXmark, faFileImport } from '@fortawesome/free-solid-svg-icons';
import type { Property, PropertyStatus } from '../types';
import type { Role } from '../hooks/useRole';
import { parseDate } from '../utils/dateUtils';
import { getSaleStartDate } from '../utils/salesHelpers';

const MONTH_CELL_W = 52;
const FY_MONTH_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2]; // Apr..Mar

// 会計年度（4月始まり）
function fiscalYearOf(date: Date): number {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

function buildMonths(fy: number): { year: number; month: number }[] {
  return FY_MONTH_ORDER.map((m) => ({
    year: m >= 3 ? fy : fy + 1,
    month: m,
  }));
}

function formatYen(n: number | null | undefined): string {
  if (n == null) return '';
  const oku = Math.floor(n / 100000000);
  const man = Math.floor((n % 100000000) / 10000);
  if (oku > 0 && man > 0) return `${oku}億${man}万`;
  if (oku > 0) return `${oku}億`;
  if (man > 0) return `${man.toLocaleString('ja-JP')}万`;
  return `${n.toLocaleString('ja-JP')}`;
}

function STATUS_COLOR(s: PropertyStatus | null | undefined): string {
  switch (s) {
    case '契約済':       return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    case '契約予定':     return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
    case '期中完成販売': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case '完成済':       return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
    case 'R8年度完成':   return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
    case '竣工予定日なし': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    default: return 'bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500';
  }
}

interface Props {
  properties: Property[];
  role: Role;
  onEdit: (propertyId: string) => void;
  onImportCsv: () => void;
}

export function SalesPlanView({ properties, role, onEdit, onImportCsv }: Props) {
  const canEdit = role === 'admin' || role === 'editor';
  const [fy, setFy] = useState<number>(() => fiscalYearOf(new Date()));
  const [search, setSearch] = useState('');

  const months = useMemo(() => buildMonths(fy), [fy]);

  // 工程期間を 1 本化：非表示を除いたタスクの min(start) / max(end)
  function taskRange(p: Property): { start: Date | null; end: Date | null } {
    const dates = p.tasks
      .filter(t => !t.hidden)
      .flatMap(t => [parseDate(t.startDate), parseDate(t.endDate)])
      .filter((d): d is Date => !!d);
    if (dates.length === 0) return { start: null, end: null };
    const times = dates.map(d => d.getTime());
    return { start: new Date(Math.min(...times)), end: new Date(Math.max(...times)) };
  }

  const fyRange = useMemo(() => {
    const start = new Date(fy, 3, 1);
    const end = new Date(fy + 1, 2, 31, 23, 59, 59);
    return { start, end };
  }, [fy]);

  // FY に関係する物件だけ：工程期間が FY に重なる or 販売開始/契約日が FY 範囲内
  // ただし契約日が表示FYより前の年度なら除外（前期以前に契約済のものは次年度以降には載らない）
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return properties.filter(p => {
      if (q && !(p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))) return false;
      const { start, end } = taskRange(p);
      const sale = parseDate(getSaleStartDate(p));
      const contract = parseDate(p.contractDate ?? null);
      // 契約日が表示FYの開始より前なら、その物件は表示しない
      if (contract && contract.getTime() < fyRange.start.getTime()) return false;
      const inFY = (d: Date | null) =>
        !!d && d.getTime() >= fyRange.start.getTime() && d.getTime() <= fyRange.end.getTime();
      const rangeOverlap = start && end && start <= fyRange.end && end >= fyRange.start;
      return rangeOverlap || inFY(sale) || inFY(contract);
    });
  }, [properties, fyRange, search]);

  function cellForTaskRange(
    range: { start: Date | null; end: Date | null },
    month: { year: number; month: number },
  ): boolean {
    if (!range.start || !range.end) return false;
    const ms = new Date(month.year, month.month, 1).getTime();
    const me = new Date(month.year, month.month + 1, 0, 23, 59, 59).getTime();
    return range.start.getTime() <= me && range.end.getTime() >= ms;
  }

  function cellIsSaleMonth(saleStart: Date | null, month: { year: number; month: number }): boolean {
    if (!saleStart) return false;
    return saleStart.getFullYear() === month.year && saleStart.getMonth() === month.month;
  }

  // 月別の販売価格合計
  const monthlyTotals = useMemo(() => {
    return months.map(m => {
      return filtered.reduce((sum, p) => {
        const sale = parseDate(getSaleStartDate(p));
        if (!sale || !p.salePrice) return sum;
        if (sale.getFullYear() === m.year && sale.getMonth() === m.month) return sum + p.salePrice;
        return sum;
      }, 0);
    });
  }, [filtered, months]);

  const totalSum = monthlyTotals.reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 md:px-6 py-3 md:py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100">販売計画</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              FY{fy}（{fy}/4 〜 {fy + 1}/3）· 対象 {filtered.length} 件 / 合計 {formatYen(totalSum)} 円
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={onImportCsv}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 border border-blue-300 dark:border-blue-700 hover:border-blue-500 rounded-lg px-3 py-2 transition"
                title="CSVファイルから物件データをインポート"
              >
                <FontAwesomeIcon icon={faFileImport} />
                <span className="hidden sm:inline">CSVインポート</span>
              </button>
            )}
            <button
              onClick={() => setFy(fy - 1)}
              className="text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 hover:border-gray-400 transition"
            >
              ◀ {fy - 1}
            </button>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 px-2">
              FY{fy}
            </div>
            <button
              onClick={() => setFy(fy + 1)}
              className="text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 hover:border-gray-400 transition"
            >
              {fy + 1} ▶
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="物件名・物件IDで検索"
            className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
              title="クリア"
            >
              <FontAwesomeIcon icon={faXmark} className="text-xs" />
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <div className="inline-flex min-w-full">
          {/* Left: property info */}
          <div className="sticky left-0 z-20 bg-white dark:bg-gray-800 shrink-0 shadow-[2px_0_6px_rgba(0,0,0,0.08)]">
            <div className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex h-16">
              <div className="w-24 px-2 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 flex items-end">ID</div>
              <div className="w-56 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 flex items-end">物件名</div>
              <div className="w-28 px-2 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 flex items-end">種別</div>
              <div className="w-28 px-2 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 flex items-end">ステータス</div>
              <div className="w-24 px-2 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 flex items-end text-right">販売価格</div>
            </div>
            {filtered.map(p => {
              const signed = p.status === '契約済';
              return (
              <div
                key={p.id}
                className={`flex items-center border-b border-gray-100 dark:border-gray-700 h-11 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer group ${
                  signed ? 'bg-gray-200/60 dark:bg-gray-700/40' : ''
                }`}
                onClick={() => canEdit && onEdit(p.id)}
              >
                <div className="w-24 px-2 text-[10px] font-mono text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">
                  {p.id}
                </div>
                <div className="w-56 px-3 text-xs font-medium text-gray-700 dark:text-gray-200 truncate border-r border-gray-200 dark:border-gray-700 flex items-center gap-2" title={p.name}>
                  <span className="truncate">{p.name}</span>
                  {canEdit && (
                    <FontAwesomeIcon icon={faPen} className="text-[10px] opacity-0 group-hover:opacity-60 shrink-0" />
                  )}
                </div>
                <div className="w-28 px-2 text-[11px] text-gray-600 dark:text-gray-300 truncate border-r border-gray-200 dark:border-gray-700">
                  {p.propertyType || '―'}
                </div>
                <div className="w-28 px-2 border-r border-gray-200 dark:border-gray-700">
                  {p.status ? (
                    <span className={`inline-block text-[10px] px-2 py-0.5 rounded ${STATUS_COLOR(p.status)}`}>{p.status}</span>
                  ) : (
                    <span className="text-[10px] text-gray-400">―</span>
                  )}
                </div>
                <div className={`w-24 px-2 border-r border-gray-200 dark:border-gray-700 flex flex-col justify-center text-right ${p.pricePending ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}>
                  <span className="text-[11px] font-mono truncate">{p.salePrice ? formatYen(p.salePrice) : '―'}</span>
                  {p.salePriceUpdatedAt && (
                    <span
                      className="text-[9px] text-blue-500 truncate"
                      title={`価格変更日: ${new Date(p.salePriceUpdatedAt).toLocaleString('ja-JP')}`}
                    >
                      📍 {new Date(p.salePriceUpdatedAt).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
              );
            })}
            {/* totals row */}
            <div className="flex items-center border-b-2 border-gray-300 dark:border-gray-600 h-10 bg-gray-50 dark:bg-gray-900/70">
              <div className="w-24 px-2 text-[10px] font-mono text-gray-500 border-r border-gray-200 dark:border-gray-700">合計</div>
              <div className="w-56 px-3 text-xs font-semibold text-gray-700 dark:text-gray-200 border-r border-gray-200 dark:border-gray-700">月別 販売価格合計</div>
              <div className="w-28 border-r border-gray-200 dark:border-gray-700" />
              <div className="w-28 border-r border-gray-200 dark:border-gray-700" />
              <div className="w-24 px-2 text-[11px] font-mono text-right border-r border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200">
                {formatYen(totalSum)}
              </div>
            </div>
          </div>

          {/* Right: month grid */}
          <div className="shrink-0">
            <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
              <div className="flex bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 h-8">
                {months.map((m, mi) => (
                  <div
                    key={`${m.year}-${m.month}`}
                    style={{ width: MONTH_CELL_W }}
                    className="text-center text-[10px] font-semibold py-1 border-r border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                  >
                    {(mi === 0 || m.month === 0) && (
                      <span className="text-gray-400 mr-0.5">{m.year}/</span>
                    )}
                    {m.month + 1}月
                  </div>
                ))}
              </div>
              <div className="h-8 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900" />
            </div>
            {filtered.map(p => {
              const range = taskRange(p);
              const sale = parseDate(getSaleStartDate(p));
              const signed = p.status === '契約済';
              return (
                <div
                  key={p.id}
                  className={`flex border-b border-gray-100 dark:border-gray-700 h-11 items-center ${
                    signed ? 'bg-gray-200/60 dark:bg-gray-700/40' : ''
                  }`}
                >
                  {months.map(m => {
                    const filled = cellForTaskRange(range, m);
                    const saleCell = cellIsSaleMonth(sale, m);
                    return (
                      <div
                        key={`${m.year}-${m.month}`}
                        style={{ width: MONTH_CELL_W }}
                        className="relative h-full border-r border-gray-100 dark:border-gray-700 flex items-center justify-center"
                      >
                        {filled && (
                          <div className="absolute inset-x-0.5 top-2.5 bottom-2.5 rounded bg-blue-300/70 dark:bg-blue-400/60" />
                        )}
                        {saleCell && (
                          <div
                            className={`absolute inset-x-0.5 top-1 bottom-1 rounded-sm flex items-center justify-center text-[10px] font-semibold ${
                              p.pricePending
                                ? 'bg-yellow-200 dark:bg-yellow-500/70 text-gray-800 dark:text-gray-900'
                                : 'bg-orange-300 dark:bg-orange-400 text-gray-900'
                            }`}
                            title={`販売開始: ${getSaleStartDate(p) ?? ''} / 価格: ${p.salePrice ?? '未設定'}`}
                          >
                            {p.salePrice ? formatYen(p.salePrice) : '未定'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {/* Totals row */}
            <div className="flex border-b-2 border-gray-300 dark:border-gray-600 h-10 items-center bg-gray-50 dark:bg-gray-900/70">
              {monthlyTotals.map((t, i) => (
                <div
                  key={i}
                  style={{ width: MONTH_CELL_W }}
                  className="text-center text-[10px] font-mono text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700"
                >
                  {t > 0 ? formatYen(t) : ''}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 md:px-6 py-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-3 shrink-0 text-[11px] text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-3 rounded bg-blue-300/70" />
          <span>加工期間（工程の最早〜最遅）</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-3 rounded bg-orange-300" />
          <span>販売開始月</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-3 rounded bg-yellow-200" />
          <span>販売価格 未確定</span>
        </div>
        {filtered.length > 0 && (
          <div className="ml-auto">行クリックで編集</div>
        )}
      </div>
    </div>
  );
}
