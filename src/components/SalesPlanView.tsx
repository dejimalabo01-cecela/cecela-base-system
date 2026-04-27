import { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPen, faSearch, faXmark, faFileImport, faTrash, faCopy,
  faFileExcel, faDownload, faChevronDown,
} from '@fortawesome/free-solid-svg-icons';
import type { Property, PropertyStatus, PropertyType } from '../types';
import { PROPERTY_STATUS_OPTIONS, PROPERTY_TYPE_OPTIONS } from '../types';
import type { Role } from '../hooks/useRole';
import { parseDate } from '../utils/dateUtils';
import { getSaleStartDate } from '../utils/salesHelpers';
import { Pagination, SortHeader } from './Pagination';
import { exportSalesPlanToCSV, exportSalesPlanToExcel } from '../utils/exportUtils';
import { ContractDetailModal } from './ContractDetailModal';

type SortKey = 'id' | 'name' | 'type' | 'status' | 'price';
type SortDir = 'asc' | 'desc';

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
  members: import('../types').Member[];
  onEdit: (propertyId: string) => void;
  onImportCsv: () => void;
  onDeleteMany: (ids: string[]) => Promise<void>;
  onCopyMany: (ids: string[], copyDates: boolean) => Promise<number>;
}

export function SalesPlanView({
  properties, role, members, onEdit, onImportCsv, onDeleteMany, onCopyMany,
}: Props) {
  const canEdit = role === 'admin' || role === 'editor';
  const isAdmin = role === 'admin';
  const todayFy = useMemo(() => fiscalYearOf(new Date()), []);
  const [fy, setFy] = useState<number>(todayFy);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PropertyStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<PropertyType | ''>('');
  const [sortKey, setSortKey] = useState<SortKey>('id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [copying, setCopying] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  // 契約金額の内訳ポップアップ。{year, month: null} = 年合計、{year, month: 0..11} = その月
  const [contractDetail, setContractDetail] = useState<null | { year: number; month: number | null }>(null);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() { setSelected(new Set()); }

  async function handleBulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`選択した ${ids.length} 件を削除します。この操作は取り消せません。`)) return;
    setDeleting(true);
    try {
      await onDeleteMany(ids);
      clearSelection();
    } finally {
      setDeleting(false);
    }
  }

  async function handleBulkCopy() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`選択した ${ids.length} 件を複製します。\n物件名は「○○_コピー」、工程・担当者・日付・販売情報すべて引き継ぎます。`)) return;
    setCopying(true);
    try {
      await onCopyMany(ids, true);
      clearSelection();
    } finally {
      setCopying(false);
    }
  }

  type ExportScope = 'all' | 'fy' | 'selected';
  type ExportFormat = 'csv' | 'excel';

  function doExport(scope: ExportScope, format: ExportFormat) {
    setExportMenuOpen(false);
    let target: Property[] = [];
    let suffix = '';
    if (scope === 'all') { target = properties; suffix = '全件'; }
    else if (scope === 'fy') { target = filtered; suffix = `FY${fy}`; }
    else { target = properties.filter(p => selected.has(p.id)); suffix = `選択${target.length}件`; }
    if (target.length === 0) return;
    const ext = format === 'csv' ? 'csv' : 'xlsx';
    const filename = `cecela_販売計画_${suffix}.${ext}`;
    if (format === 'csv') exportSalesPlanToCSV(target, members, filename);
    else exportSalesPlanToExcel(target, members, filename);
  }

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
  // 日付が一切無い物件は「未スケジュール」として今期に表示する。
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return properties.filter(p => {
      if (q && !(p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (typeFilter && p.propertyType !== typeFilter) return false;
      const { start, end } = taskRange(p);
      const sale = parseDate(getSaleStartDate(p));
      const contract = parseDate(p.contractDate ?? null);
      // 契約日が表示FYの開始より前なら、その物件は表示しない
      if (contract && contract.getTime() < fyRange.start.getTime()) return false;
      const inFY = (d: Date | null) =>
        !!d && d.getTime() >= fyRange.start.getTime() && d.getTime() <= fyRange.end.getTime();
      const rangeOverlap = start && end && start <= fyRange.end && end >= fyRange.start;
      // 日付が一切無い物件は今期のみ表示（拾いこぼし防止）
      const hasAnyDate = !!start || !!end || !!sale || !!contract;
      if (!hasAnyDate) return fy === todayFy;
      return rangeOverlap || inFY(sale) || inFY(contract);
    });
  }, [properties, fy, todayFy, fyRange, search, statusFilter, typeFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'id':     return a.id.localeCompare(b.id, 'ja') * dir;
        case 'name':   return a.name.localeCompare(b.name, 'ja') * dir;
        case 'type':   return ((a.propertyType ?? '\uFFFF').localeCompare(b.propertyType ?? '\uFFFF', 'ja')) * dir;
        case 'status': return ((a.status ?? '\uFFFF').localeCompare(b.status ?? '\uFFFF', 'ja')) * dir;
        case 'price':  return ((a.salePrice ?? -Infinity) - (b.salePrice ?? -Infinity)) * dir;
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // 検索や並び順、FY、絞り込み、ページサイズが変わったらページを1に戻す
  useEffect(() => { setPage(1); }, [search, sortKey, sortDir, fy, pageSize, statusFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageRows = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize],
  );

  const visibleSelectedCount = pageRows.filter(p => selected.has(p.id)).length;
  const allVisibleChecked = pageRows.length > 0 && visibleSelectedCount === pageRows.length;
  const someVisibleChecked = visibleSelectedCount > 0 && !allVisibleChecked;
  function toggleAllVisible() {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleChecked) pageRows.forEach(p => next.delete(p.id));
      else pageRows.forEach(p => next.add(p.id));
      return next;
    });
  }

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

  // 月別の販売価格合計（販売開始月で集計）
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

  // 月別の契約金額合計（契約日月で集計、契約済の物件のみ）
  const contractMonthlyTotals = useMemo(() => {
    return months.map(m => {
      return filtered.reduce((sum, p) => {
        const c = parseDate(p.contractDate ?? null);
        if (!c || !p.salePrice) return sum;
        if (c.getFullYear() === m.year && c.getMonth() === m.month) return sum + p.salePrice;
        return sum;
      }, 0);
    });
  }, [filtered, months]);
  const contractTotalSum = contractMonthlyTotals.reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 md:px-6 py-3 md:py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100">販売計画</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              FY{fy}（{fy}/4 〜 {fy + 1}/3）· 対象 {filtered.length} 件
              {selected.size > 0 && ` · 選択 ${selected.size} 件`}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              販売価格合計 <span className="font-mono text-gray-700 dark:text-gray-200">{formatYen(totalSum) || '0'}</span>
              <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
              契約金額合計{' '}
              {contractTotalSum > 0 ? (
                <button
                  onClick={() => setContractDetail({ year: fy, month: null })}
                  className="font-mono text-blue-700 dark:text-blue-300 underline decoration-dotted underline-offset-2 hover:text-blue-900 dark:hover:text-blue-100"
                  title="クリックで契約物件の内訳を表示"
                >
                  {formatYen(contractTotalSum)}
                </button>
              ) : (
                <span className="font-mono text-gray-700 dark:text-gray-200">0</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* 一括アクション（選択中のみ表示） */}
            {canEdit && selected.size > 0 && (
              <button
                onClick={handleBulkCopy}
                disabled={copying}
                className="flex items-center gap-1.5 text-xs md:text-sm text-blue-600 hover:text-blue-700 border border-blue-300 dark:border-blue-700 hover:border-blue-500 rounded-lg px-3 py-2 transition disabled:opacity-40"
                title="選択した物件を複製"
              >
                <FontAwesomeIcon icon={faCopy} />
                <span>{copying ? '複製中…' : `複製（${selected.size}）`}</span>
              </button>
            )}
            {isAdmin && selected.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 text-xs md:text-sm text-red-600 hover:text-red-700 border border-red-300 dark:border-red-700 hover:border-red-500 rounded-lg px-3 py-2 transition disabled:opacity-40"
                title="選択した物件を削除"
              >
                <FontAwesomeIcon icon={faTrash} />
                <span>{deleting ? '削除中…' : `削除（${selected.size}）`}</span>
              </button>
            )}

            {/* エクスポート ドロップダウン */}
            <div className="relative">
              <button
                onClick={() => setExportMenuOpen(v => !v)}
                className="flex items-center gap-1.5 text-xs md:text-sm text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:border-gray-400 rounded-lg px-3 py-2 transition"
              >
                <FontAwesomeIcon icon={faDownload} />
                <span>エクスポート</span>
                <FontAwesomeIcon icon={faChevronDown} className="text-[10px]" />
              </button>
              {exportMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setExportMenuOpen(false)} aria-hidden="true" />
                  <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-40 py-1 text-xs">
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">全件 ({properties.length})</div>
                    <button onClick={() => doExport('all', 'excel')} className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                      <FontAwesomeIcon icon={faFileExcel} className="text-green-600" /> Excel
                    </button>
                    <button onClick={() => doExport('all', 'csv')} className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                      <FontAwesomeIcon icon={faDownload} /> CSV
                    </button>
                    <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">FY{fy} ({filtered.length})</div>
                    <button onClick={() => doExport('fy', 'excel')} className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                      <FontAwesomeIcon icon={faFileExcel} className="text-green-600" /> Excel
                    </button>
                    <button onClick={() => doExport('fy', 'csv')} className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                      <FontAwesomeIcon icon={faDownload} /> CSV
                    </button>
                    <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">選択中 ({selected.size})</div>
                    <button
                      onClick={() => doExport('selected', 'excel')}
                      disabled={selected.size === 0}
                      className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <FontAwesomeIcon icon={faFileExcel} className="text-green-600" /> Excel
                    </button>
                    <button
                      onClick={() => doExport('selected', 'csv')}
                      disabled={selected.size === 0}
                      className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <FontAwesomeIcon icon={faDownload} /> CSV
                    </button>
                  </div>
                </>
              )}
            </div>

            {canEdit && (
              <button
                onClick={onImportCsv}
                className="flex items-center gap-1.5 text-xs md:text-sm text-blue-600 hover:text-blue-700 border border-blue-300 dark:border-blue-700 hover:border-blue-500 rounded-lg px-3 py-2 transition"
                title="CSVファイルから物件データをインポート"
              >
                <FontAwesomeIcon icon={faFileImport} />
                <span className="hidden sm:inline">CSVインポート</span>
              </button>
            )}

            <div className="flex items-center gap-1">
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
        </div>

        {/* Search & filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative max-w-xs flex-1 min-w-[180px]">
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

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as PropertyStatus | '')}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="契約ステータスで絞り込み"
          >
            <option value="">ステータス：すべて</option>
            {PROPERTY_STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as PropertyType | '')}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="物件種別で絞り込み"
          >
            <option value="">種別：すべて</option>
            {PROPERTY_TYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>

          {(statusFilter || typeFilter) && (
            <button
              onClick={() => { setStatusFilter(''); setTypeFilter(''); }}
              className="text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 hover:border-gray-400 rounded-lg px-3 py-2 transition"
              title="絞り込みをクリア"
            >
              絞り込み解除
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
              <div className="w-10 px-1 py-2 border-r border-gray-200 dark:border-gray-700 flex items-end justify-center">
                <input
                  type="checkbox"
                  checked={allVisibleChecked}
                  ref={el => { if (el) el.indeterminate = someVisibleChecked; }}
                  onChange={toggleAllVisible}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  aria-label="ページ内 全件選択"
                />
              </div>
              <div className="w-24 px-2 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 flex items-end">
                <SortHeader label="ID" active={sortKey === 'id'} dir={sortDir} onClick={() => toggleSort('id')} />
              </div>
              <div className="w-56 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 flex items-end">
                <SortHeader label="物件名" active={sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
              </div>
              <div className="w-28 px-2 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 flex items-end">
                <SortHeader label="種別" active={sortKey === 'type'} dir={sortDir} onClick={() => toggleSort('type')} />
              </div>
              <div className="w-28 px-2 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 flex items-end">
                <SortHeader label="ステータス" active={sortKey === 'status'} dir={sortDir} onClick={() => toggleSort('status')} />
              </div>
              <div className="w-24 px-2 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 flex items-end text-right">
                <SortHeader label="販売価格" active={sortKey === 'price'} dir={sortDir} onClick={() => toggleSort('price')} className="ml-auto" />
              </div>
            </div>
            {pageRows.map(p => {
              const signed = p.status === '契約済';
              const isChecked = selected.has(p.id);
              return (
              <div
                key={p.id}
                className={`flex items-center border-b border-gray-100 dark:border-gray-700 h-11 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer group ${
                  isChecked ? 'bg-blue-50/80 dark:bg-blue-900/30' : signed ? 'bg-gray-200/60 dark:bg-gray-700/40' : ''
                }`}
                onClick={() => canEdit && onEdit(p.id)}
              >
                <div className="w-10 px-1 border-r border-gray-200 dark:border-gray-700 flex items-center justify-center" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleOne(p.id)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    aria-label={`${p.name} を選択`}
                  />
                </div>
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
            {/* totals row 1: 販売価格 */}
            <div className="flex items-center border-b border-gray-200 dark:border-gray-700 h-10 bg-gray-50 dark:bg-gray-900/70">
              <div className="w-10 border-r border-gray-200 dark:border-gray-700" />
              <div className="w-24 px-2 text-[10px] font-mono text-gray-500 border-r border-gray-200 dark:border-gray-700">合計</div>
              <div className="w-56 px-3 text-xs font-semibold text-gray-700 dark:text-gray-200 border-r border-gray-200 dark:border-gray-700">販売価格 合計（月＝販売開始月）</div>
              <div className="w-28 border-r border-gray-200 dark:border-gray-700" />
              <div className="w-28 border-r border-gray-200 dark:border-gray-700" />
              <div className="w-24 px-2 text-[11px] font-mono text-right border-r border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200">
                {formatYen(totalSum)}
              </div>
            </div>
            {/* totals row 2: 契約金額 */}
            <div className="flex items-center border-b-2 border-gray-300 dark:border-gray-600 h-10 bg-blue-50/40 dark:bg-blue-900/20">
              <div className="w-10 border-r border-gray-200 dark:border-gray-700" />
              <div className="w-24 px-2 text-[10px] font-mono text-blue-600 dark:text-blue-300 border-r border-gray-200 dark:border-gray-700">契約合計</div>
              <div className="w-56 px-3 text-xs font-semibold text-blue-700 dark:text-blue-200 border-r border-gray-200 dark:border-gray-700">契約金額 合計（月＝契約日）</div>
              <div className="w-28 border-r border-gray-200 dark:border-gray-700" />
              <div className="w-28 border-r border-gray-200 dark:border-gray-700" />
              <button
                onClick={() => contractTotalSum > 0 && setContractDetail({ year: fy, month: null })}
                disabled={contractTotalSum === 0}
                className="w-24 px-2 text-[11px] font-mono text-right border-r border-gray-200 dark:border-gray-700 text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:cursor-default disabled:hover:bg-transparent transition cursor-pointer h-full"
                title={contractTotalSum > 0 ? 'クリックで契約物件の内訳を表示' : ''}
              >
                {contractTotalSum > 0 ? (
                  <span className="underline decoration-dotted underline-offset-2">{formatYen(contractTotalSum)}</span>
                ) : ''}
              </button>
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
            {pageRows.map(p => {
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
            {/* Totals row 1: 販売価格 月別 */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 h-10 items-center bg-gray-50 dark:bg-gray-900/70">
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
            {/* Totals row 2: 契約金額 月別 */}
            <div className="flex border-b-2 border-gray-300 dark:border-gray-600 h-10 items-center bg-blue-50/40 dark:bg-blue-900/20">
              {contractMonthlyTotals.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => t > 0 && setContractDetail({ year: months[i].year, month: months[i].month })}
                  disabled={t === 0}
                  style={{ width: MONTH_CELL_W }}
                  className="text-center text-[10px] font-mono text-blue-700 dark:text-blue-200 border-r border-gray-200 dark:border-gray-700 h-full hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:cursor-default disabled:hover:bg-transparent transition"
                  title={t > 0 ? `${months[i].year}/${months[i].month + 1}月の契約物件を表示` : ''}
                >
                  {t > 0 ? (
                    <span className="underline decoration-dotted underline-offset-2 cursor-pointer">{formatYen(t)}</span>
                  ) : ''}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Pagination */}
      <div className="px-4 md:px-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shrink-0">
        <Pagination
          total={sorted.length}
          page={safePage}
          pageSize={pageSize}
          onChangePage={setPage}
          onChangePageSize={setPageSize}
        />
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

      {/* 契約金額の内訳ポップアップ */}
      {contractDetail && (() => {
        const detailProps = filtered.filter(p => {
          const c = parseDate(p.contractDate ?? null);
          if (!c || !p.salePrice) return false;
          if (contractDetail.month == null) {
            // 年合計：FY範囲（4月〜翌年3月）に契約日が入っているもの
            const fyStart = new Date(contractDetail.year, 3, 1).getTime();
            const fyEnd   = new Date(contractDetail.year + 1, 2, 31, 23, 59, 59).getTime();
            return c.getTime() >= fyStart && c.getTime() <= fyEnd;
          }
          // 月：その月に契約日が入っているもの
          return c.getFullYear() === contractDetail.year && c.getMonth() === contractDetail.month;
        });
        const detailTotal = detailProps.reduce((s, p) => s + (p.salePrice ?? 0), 0);
        const title = contractDetail.month == null
          ? `FY${contractDetail.year} 契約物件の内訳`
          : `${contractDetail.year}年${contractDetail.month + 1}月 契約物件の内訳`;
        const subtitle = contractDetail.month == null
          ? `${contractDetail.year}/4 〜 ${contractDetail.year + 1}/3 に契約日がある物件`
          : '契約日でフィルタしています';
        return (
          <ContractDetailModal
            title={title}
            subtitle={subtitle}
            properties={detailProps}
            total={detailTotal}
            onSelect={canEdit ? (id) => onEdit(id) : undefined}
            onClose={() => setContractDetail(null)}
          />
        );
      })()}
    </div>
  );
}
