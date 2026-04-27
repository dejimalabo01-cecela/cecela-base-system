import { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faXmark, faClock } from '@fortawesome/free-solid-svg-icons';
import type { Property, PropertyStatus } from '../types';
import { PROPERTY_STATUS_OPTIONS } from '../types';
import type { Role } from '../hooks/useRole';
import { Pagination, SortHeader } from './Pagination';
import { ResizeHandle } from './ResizeHandle';
import { useColumnWidths } from '../hooks/useColumnWidths';

type SortKey = 'id' | 'name' | 'saleStartDate' | 'salePrice' | 'status' | 'contractDate' | 'settlementDate';
type SortDir = 'asc' | 'desc';

type ColKey = 'id' | 'name' | 'saleStartDate' | 'salePrice' | 'status' | 'contractDate' | 'settlementDate' | 'priceUpdatedAt';
const DEFAULT_WIDTHS: Record<ColKey, number> = {
  id: 100, name: 240, saleStartDate: 130, salePrice: 150, status: 130,
  contractDate: 130, settlementDate: 130, priceUpdatedAt: 150,
};

interface Props {
  properties: Property[];
  role: Role;
  onSaveSalesInfo: (
    propertyId: string,
    updates: Partial<Pick<Property,
      'salePrice' | 'pricePending' | 'status' |
      'saleStartDate' | 'contractDate' | 'settlementDate'
    >>,
  ) => Promise<void>;
}

function statusColor(s: PropertyStatus | null | undefined): string {
  switch (s) {
    case '契約済':       return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    case '契約予定':     return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
    case '期中完成販売': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case '完成済':       return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
    case 'R8年度完成':   return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
    case '竣工予定日なし': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    default: return '';
  }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function SalesManagementView({ properties, role, onSaveSalesInfo }: Props) {
  const canEdit = role === 'admin' || role === 'editor';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PropertyStatus | ''>('');
  const [sortKey, setSortKey] = useState<SortKey>('id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);
  const [savingId, setSavingId] = useState<string | null>(null);

  const { widths: colW, setWidth: setColW } = useColumnWidths<ColKey>(
    'colw:sales-management',
    DEFAULT_WIDTHS,
  );
  const cellW = (k: ColKey): React.CSSProperties => ({ width: colW[k], minWidth: colW[k] });

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  }

  // フィルタリング
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return properties.filter(p => {
      if (q && !(p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      return true;
    });
  }, [properties, search, statusFilter]);

  // ソート
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const av: string | number = (() => {
        switch (sortKey) {
          case 'id': return a.id;
          case 'name': return a.name;
          case 'saleStartDate': return a.saleStartDate ?? '';
          case 'salePrice': return a.salePrice ?? -Infinity;
          case 'status': return a.status ?? '';
          case 'contractDate': return a.contractDate ?? '';
          case 'settlementDate': return a.settlementDate ?? '';
        }
      })();
      const bv: string | number = (() => {
        switch (sortKey) {
          case 'id': return b.id;
          case 'name': return b.name;
          case 'saleStartDate': return b.saleStartDate ?? '';
          case 'salePrice': return b.salePrice ?? -Infinity;
          case 'status': return b.status ?? '';
          case 'contractDate': return b.contractDate ?? '';
          case 'settlementDate': return b.settlementDate ?? '';
        }
      })();
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), 'ja') * dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  useEffect(() => { setPage(1); }, [search, statusFilter, sortKey, sortDir, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageRows = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize],
  );

  // 1フィールドだけ更新するラッパー
  async function update(p: Property, patch: Parameters<typeof onSaveSalesInfo>[1]) {
    setSavingId(p.id);
    try {
      await onSaveSalesInfo(p.id, patch);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 md:px-6 py-3 md:py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100">販売管理</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              全 {properties.length} 件
              {(search || statusFilter) && ` / 該当 ${filtered.length} 件`}
            </p>
          </div>
        </div>

        {/* Search & filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative max-w-xs flex-1 min-w-[180px]">
            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="物件名・物件IDで検索"
              className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1">
                <FontAwesomeIcon icon={faXmark} className="text-xs" />
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as PropertyStatus | '')}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">ステータス：すべて</option>
            {PROPERTY_STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          {(search || statusFilter) && (
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); }}
              className="text-xs text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-gray-400 rounded-lg px-3 py-2 transition"
            >
              絞り込み解除
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {properties.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600 p-6">
            <p className="text-lg font-medium">物件が登録されていません</p>
          </div>
        ) : pageRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600 p-6">
            <p className="text-lg font-medium">該当する物件がありません</p>
          </div>
        ) : (
          <div className="inline-block min-w-full">
            {/* Header row */}
            <div className="sticky top-0 z-20 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex h-10 items-center text-xs font-semibold text-gray-600 dark:text-gray-400">
              <div style={cellW('id')} className="relative px-3 py-2 border-r border-gray-200 dark:border-gray-700 shrink-0 flex items-center">
                <SortHeader label="物件ID" active={sortKey === 'id'} dir={sortDir} onClick={() => toggleSort('id')} />
                <ResizeHandle getCurrent={() => colW.id} onResize={w => setColW('id', w)} />
              </div>
              <div style={cellW('name')} className="relative px-3 py-2 border-r border-gray-200 dark:border-gray-700 shrink-0 flex items-center">
                <SortHeader label="物件名" active={sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
                <ResizeHandle getCurrent={() => colW.name} onResize={w => setColW('name', w)} />
              </div>
              <div style={cellW('saleStartDate')} className="relative px-2 py-2 border-r border-gray-200 dark:border-gray-700 shrink-0 flex items-center">
                <SortHeader label="販売開始日" active={sortKey === 'saleStartDate'} dir={sortDir} onClick={() => toggleSort('saleStartDate')} />
                <ResizeHandle getCurrent={() => colW.saleStartDate} onResize={w => setColW('saleStartDate', w)} />
              </div>
              <div style={cellW('salePrice')} className="relative px-2 py-2 border-r border-gray-200 dark:border-gray-700 shrink-0 flex items-center">
                <SortHeader label="販売価格" active={sortKey === 'salePrice'} dir={sortDir} onClick={() => toggleSort('salePrice')} />
                <ResizeHandle getCurrent={() => colW.salePrice} onResize={w => setColW('salePrice', w)} />
              </div>
              <div style={cellW('status')} className="relative px-2 py-2 border-r border-gray-200 dark:border-gray-700 shrink-0 flex items-center">
                <SortHeader label="ステータス" active={sortKey === 'status'} dir={sortDir} onClick={() => toggleSort('status')} />
                <ResizeHandle getCurrent={() => colW.status} onResize={w => setColW('status', w)} />
              </div>
              <div style={cellW('contractDate')} className="relative px-2 py-2 border-r border-gray-200 dark:border-gray-700 shrink-0 flex items-center">
                <SortHeader label="契約日" active={sortKey === 'contractDate'} dir={sortDir} onClick={() => toggleSort('contractDate')} />
                <ResizeHandle getCurrent={() => colW.contractDate} onResize={w => setColW('contractDate', w)} />
              </div>
              <div style={cellW('settlementDate')} className="relative px-2 py-2 border-r border-gray-200 dark:border-gray-700 shrink-0 flex items-center">
                <SortHeader label="決済日" active={sortKey === 'settlementDate'} dir={sortDir} onClick={() => toggleSort('settlementDate')} />
                <ResizeHandle getCurrent={() => colW.settlementDate} onResize={w => setColW('settlementDate', w)} />
              </div>
              <div style={cellW('priceUpdatedAt')} className="relative px-2 py-2 border-r border-gray-200 dark:border-gray-700 shrink-0 flex items-center text-gray-500 dark:text-gray-500">
                価格変更日
                <ResizeHandle getCurrent={() => colW.priceUpdatedAt} onResize={w => setColW('priceUpdatedAt', w)} />
              </div>
            </div>

            {/* Body rows */}
            {pageRows.map((p, idx) => {
              const saving = savingId === p.id;
              return (
                <div
                  key={p.id}
                  className={`flex items-center border-b border-gray-100 dark:border-gray-700 h-12 ${
                    idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/40 dark:bg-gray-800/40'
                  }`}
                >
                  <div style={cellW('id')} className="px-3 text-xs font-mono text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 shrink-0 truncate" title={p.id}>
                    {p.id}
                  </div>
                  <div style={cellW('name')} className="px-3 text-sm text-gray-800 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700 shrink-0 truncate" title={p.name}>
                    {p.name}
                  </div>
                  <div style={cellW('saleStartDate')} className="px-2 border-r border-gray-200 dark:border-gray-700 shrink-0">
                    <input
                      type="date"
                      value={p.saleStartDate ?? ''}
                      disabled={!canEdit}
                      onChange={e => {
                        const v = e.target.value || null;
                        if (v !== (p.saleStartDate ?? null)) update(p, { saleStartDate: v });
                      }}
                      className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-60"
                    />
                  </div>
                  <div style={cellW('salePrice')} className={`px-2 border-r border-gray-200 dark:border-gray-700 shrink-0 flex items-center gap-1 ${p.pricePending ? 'bg-yellow-50/60 dark:bg-yellow-900/20' : ''}`}>
                    <input
                      key={`${p.id}:${p.salePrice ?? 'null'}`}
                      type="text"
                      inputMode="numeric"
                      defaultValue={p.salePrice != null ? p.salePrice.toLocaleString('ja-JP') : ''}
                      disabled={!canEdit}
                      placeholder="価格"
                      onBlur={e => {
                        const raw = e.target.value.replace(/[,\s¥円]/g, '');
                        const n = raw === '' ? null : parseInt(raw, 10);
                        const newVal = Number.isFinite(n as number) ? (n as number) : null;
                        if (newVal !== (p.salePrice ?? null)) update(p, { salePrice: newVal });
                      }}
                      className="flex-1 min-w-0 text-xs text-right border border-gray-200 dark:border-gray-600 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-60 font-mono"
                    />
                    <label className="flex items-center gap-1 text-[10px] text-gray-700 dark:text-gray-300 shrink-0" title="未確定">
                      <input
                        type="checkbox"
                        checked={p.pricePending ?? false}
                        disabled={!canEdit}
                        onChange={e => update(p, { pricePending: e.target.checked })}
                        className="w-3 h-3 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
                      />
                      未
                    </label>
                  </div>
                  <div style={cellW('status')} className="px-2 border-r border-gray-200 dark:border-gray-700 shrink-0">
                    <select
                      value={p.status ?? ''}
                      disabled={!canEdit}
                      onChange={e => update(p, { status: (e.target.value || null) as PropertyStatus | null })}
                      className={`w-full text-[11px] border border-gray-200 dark:border-gray-600 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-60 ${
                        p.status ? statusColor(p.status) : ''
                      }`}
                    >
                      <option value="">未設定</option>
                      {PROPERTY_STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div style={cellW('contractDate')} className="px-2 border-r border-gray-200 dark:border-gray-700 shrink-0">
                    <input
                      type="date"
                      value={p.contractDate ?? ''}
                      disabled={!canEdit}
                      onChange={e => {
                        const v = e.target.value || null;
                        if (v !== (p.contractDate ?? null)) update(p, { contractDate: v });
                      }}
                      className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-60"
                    />
                  </div>
                  <div style={cellW('settlementDate')} className="px-2 border-r border-gray-200 dark:border-gray-700 shrink-0">
                    <input
                      type="date"
                      value={p.settlementDate ?? ''}
                      disabled={!canEdit}
                      onChange={e => {
                        const v = e.target.value || null;
                        if (v !== (p.settlementDate ?? null)) update(p, { settlementDate: v });
                      }}
                      className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-60"
                    />
                  </div>
                  <div style={cellW('priceUpdatedAt')} className="px-2 border-r border-gray-200 dark:border-gray-700 shrink-0 text-[11px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-1" title={formatDateTime(p.salePriceUpdatedAt)}>
                    {p.salePriceUpdatedAt && (
                      <>
                        <FontAwesomeIcon icon={faClock} className="text-[10px] shrink-0" />
                        <span className="truncate">{formatDateTime(p.salePriceUpdatedAt)}</span>
                      </>
                    )}
                    {saving && <span className="text-[10px] text-blue-400 ml-auto">保存中…</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
    </div>
  );
}
