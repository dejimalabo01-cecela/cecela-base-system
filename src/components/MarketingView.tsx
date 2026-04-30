import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faMagnifyingGlass, faChartBar, faTableList, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import type { Inquiry, InquiryInput, Property } from '../types';
import type { Role } from '../hooks/useRole';
import { InquiryEditModal } from './InquiryEditModal';
import {
  INQUIRY_CATEGORIES,
  INQUIRY_SOURCES,
  INQUIRY_AREAS,
  INQUIRY_EXISTING_CONTACT_OPTIONS,
  INQUIRY_PRICE_STATUS_OPTIONS,
  INQUIRY_FORMAT_OPTIONS,
  labelFor,
} from '../config/marketing';

interface Props {
  inquiries: Inquiry[];
  properties: Property[];
  role: Role;
  loading: boolean;
  onAdd: (input: InquiryInput) => Promise<boolean>;
  onUpdate: (id: string, updates: Partial<InquiryInput>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

type Tab = 'list' | 'report';

// 'YYYY-MM' から月の表示用ラベル
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${y}年${parseInt(m, 10)}月`;
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function todayMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function MarketingView({ inquiries, properties, role, loading, onAdd, onUpdate, onDelete }: Props) {
  const canEdit = role === 'admin' || role === 'editor';
  const [tab, setTab] = useState<Tab>('list');
  const [month, setMonth] = useState<string>(() => todayMonth());
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<Inquiry | 'new' | null>(null);

  // 物件 ID → 物件のマップ（一覧表示でのルックアップ用）
  const propertyById = useMemo(() => {
    const m = new Map<string, Property>();
    for (const p of properties) m.set(p.id, p);
    return m;
  }, [properties]);

  // 月でフィルタ
  const monthInquiries = useMemo(() => {
    return inquiries.filter(i => i.inquiryDate.startsWith(month));
  }, [inquiries, month]);

  // 検索フィルタ（一覧用）
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return monthInquiries;
    return monthInquiries.filter(i => {
      const prop = i.propertyId ? propertyById.get(i.propertyId) : null;
      return [
        i.contactName, i.contactAddress, i.notes, i.salesperson,
        i.category, i.source, i.area, i.gaSource,
        i.propertyId, prop?.name,
      ].some(v => (v ?? '').toLowerCase().includes(q));
    });
  }, [monthInquiries, search, propertyById]);

  // 月内の前月／次月にジャンプ
  const goPrev = () => setMonth(m => shiftMonth(m, -1));
  const goNext = () => setMonth(m => shiftMonth(m, +1));

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">

      {/* ── ヘッダー ── */}
      <div className="px-4 md:px-6 py-3 md:py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base md:text-lg font-bold text-gray-800 dark:text-gray-100">反響管理</h2>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              全 {inquiries.length} 件 / 当月 {monthInquiries.length} 件
            </span>
          </div>
          {canEdit && (
            <button
              onClick={() => setEditTarget('new')}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg px-3 py-2 flex items-center gap-1.5 transition"
            >
              <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
              反響を追加
            </button>
          )}
        </div>

        {/* 月切替 + タブ */}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button onClick={goPrev} className="px-2 py-1 text-gray-600 dark:text-gray-300 hover:text-blue-500" aria-label="前月">
              <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
            </button>
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value || todayMonth())}
              className="text-sm font-semibold bg-transparent text-gray-700 dark:text-gray-200 border-0 focus:outline-none px-1"
            />
            <button onClick={goNext} className="px-2 py-1 text-gray-600 dark:text-gray-300 hover:text-blue-500" aria-label="次月">
              <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
            </button>
          </div>

          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setTab('list')}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                tab === 'list'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <FontAwesomeIcon icon={faTableList} className="text-[10px]" />
              一覧
            </button>
            <button
              onClick={() => setTab('report')}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                tab === 'report'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <FontAwesomeIcon icon={faChartBar} className="text-[10px]" />
              月次集計
            </button>
          </div>

          {tab === 'list' && (
            <div className="flex-1 min-w-[160px] relative">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="名前・住所・備考・物件などで検索"
                className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg pl-8 pr-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── 本体 ── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm py-20">
            データを読み込み中...
          </div>
        ) : tab === 'list' ? (
          <InquiryListTable
            inquiries={filtered}
            propertyById={propertyById}
            canEdit={canEdit}
            onRowClick={i => setEditTarget(i)}
          />
        ) : (
          <MonthlyReport monthInquiries={monthInquiries} monthLabel={monthLabel(month)} />
        )}
      </div>

      {/* ── 編集モーダル ── */}
      {editTarget !== null && (
        <InquiryEditModal
          inquiry={editTarget === 'new' ? null : editTarget}
          properties={properties}
          canEdit={canEdit}
          onSave={async (input) => {
            if (editTarget === 'new') return await onAdd(input);
            return await onUpdate(editTarget.id, input);
          }}
          onDelete={editTarget !== 'new' ? async () => await onDelete(editTarget.id) : undefined}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// 一覧テーブル
// ─────────────────────────────────────────────────────────────────

interface InquiryListTableProps {
  inquiries: Inquiry[];
  propertyById: Map<string, Property>;
  canEdit: boolean;
  onRowClick: (i: Inquiry) => void;
}

function InquiryListTable({ inquiries, propertyById, canEdit, onRowClick }: InquiryListTableProps) {
  if (inquiries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500 text-sm">
        <p>この月の反響データはありません</p>
        {canEdit && <p className="mt-1 text-xs">右上の「反響を追加」から登録できます</p>}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 uppercase text-[10px] tracking-wider sticky top-0">
          <tr>
            <Th>日付</Th>
            <Th>時間</Th>
            <Th>カテゴリ</Th>
            <Th>反響元</Th>
            <Th>エリア</Th>
            <Th>反響物件</Th>
            <Th>種別</Th>
            <Th>名前</Th>
            <Th>担当</Th>
            <Th>価格</Th>
            <Th>形式</Th>
          </tr>
        </thead>
        <tbody>
          {inquiries.map(i => {
            const prop = i.propertyId ? propertyById.get(i.propertyId) : null;
            return (
              <tr
                key={i.id}
                onClick={() => onRowClick(i)}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
              >
                <Td>{i.inquiryDate}</Td>
                <Td className="text-gray-500">{i.inquiryTime ?? ''}</Td>
                <Td>{i.category ?? ''}</Td>
                <Td>{i.source ?? ''}</Td>
                <Td>{i.area ?? ''}</Td>
                <Td>{prop ? `${prop.id} ${prop.name}` : (i.propertyId ?? '')}</Td>
                <Td>{i.propertyType ?? ''}</Td>
                <Td className="text-gray-700 dark:text-gray-200">{i.contactName ?? ''}</Td>
                <Td>{i.salesperson ?? ''}</Td>
                <Td>{labelFor(INQUIRY_PRICE_STATUS_OPTIONS, i.priceStatus)}</Td>
                <Td className="text-gray-500">{labelFor(INQUIRY_FORMAT_OPTIONS, i.format)}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const Th = ({ children }: { children: React.ReactNode }) => (
  <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">{children}</th>
);
const Td = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <td className={`px-2 py-2 text-gray-700 dark:text-gray-200 whitespace-nowrap ${className}`}>{children}</td>
);

// ─────────────────────────────────────────────────────────────────
// 月次集計
// ─────────────────────────────────────────────────────────────────

interface MonthlyReportProps {
  monthInquiries: Inquiry[];
  monthLabel: string;
}

function MonthlyReport({ monthInquiries, monthLabel }: MonthlyReportProps) {
  const total = monthInquiries.length;

  // 各次元での件数集計
  const byCategory   = countBy(monthInquiries, i => i.category);
  const bySource     = countBy(monthInquiries, i => i.source);
  const byArea       = countBy(monthInquiries, i => i.area);
  const byGa         = countBy(monthInquiries, i => i.gaSource);
  const bySales      = countBy(monthInquiries, i => i.salesperson);
  const byExisting   = countBy(monthInquiries, i =>
    i.existingContact ? labelFor(INQUIRY_EXISTING_CONTACT_OPTIONS, i.existingContact) : null
  );

  // 日別の件数（縦棒っぽいテキストバーで簡易表示）
  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of monthInquiries) m.set(i.inquiryDate, (m.get(i.inquiryDate) ?? 0) + 1);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [monthInquiries]);
  const maxDay = byDay.reduce((m, [, n]) => Math.max(m, n), 0);

  return (
    <div className="px-4 md:px-6 py-5 space-y-5">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 border border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{monthLabel}</div>
        <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">{total} <span className="text-base font-normal text-gray-500">件</span></div>
        <p className="text-[11px] text-gray-400 mt-1">この月の反響合計</p>
      </div>

      {total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ReportTable title="問合せカテゴリ別"     entries={byCategory}     fallbackOrder={INQUIRY_CATEGORIES} />
          <ReportTable title="反響元別"             entries={bySource}       fallbackOrder={INQUIRY_SOURCES}    />
          <ReportTable title="エリア別"             entries={byArea}         fallbackOrder={INQUIRY_AREAS}      />
          <ReportTable title="GA別"                 entries={byGa}                                              />
          <ReportTable title="既存担当者の有無"     entries={byExisting}                                        />
          <ReportTable title="営業担当別"           entries={bySales}                                           />
        </div>
      )}

      {total > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">日別件数</h3>
          <div className="space-y-1">
            {byDay.map(([day, n]) => (
              <div key={day} className="flex items-center gap-3 text-xs">
                <span className="w-24 text-gray-500 dark:text-gray-400 shrink-0">{day}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-3 relative overflow-hidden">
                  <div
                    className="bg-blue-500 h-full"
                    style={{ width: maxDay > 0 ? `${(n / maxDay) * 100}%` : '0%' }}
                    aria-hidden="true"
                  />
                </div>
                <span className="w-10 text-right font-mono text-gray-700 dark:text-gray-200 shrink-0">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {total === 0 && (
        <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-10">
          この月の反響データはまだありません
        </p>
      )}
    </div>
  );
}

function countBy<T>(items: T[], keyFn: (i: T) => string | null | undefined): { key: string; n: number }[] {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = keyFn(it);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([key, n]) => ({ key, n }))
    .sort((a, b) => b.n - a.n);
}

interface ReportTableProps {
  title: string;
  entries: { key: string; n: number }[];
  fallbackOrder?: readonly string[];
}

function ReportTable({ title, entries, fallbackOrder }: ReportTableProps) {
  // 件数順 + 件数 0 のものは fallbackOrder の中でも非表示にする（見づらいので）
  const total = entries.reduce((s, e) => s + e.n, 0);
  // 並び：件数降順 → 件数同じなら fallbackOrder の順
  const sorted = [...entries];
  if (fallbackOrder) {
    const order = new Map(fallbackOrder.map((v, i) => [v, i]));
    sorted.sort((a, b) => b.n - a.n || ((order.get(a.key) ?? 999) - (order.get(b.key) ?? 999)));
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 border border-gray-200 dark:border-gray-700">
      <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">{title}</h3>
      {sorted.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">データなし</p>
      ) : (
        <div className="space-y-1">
          {sorted.map(({ key, n }) => (
            <div key={key} className="flex items-center gap-3 text-xs">
              <span className="flex-1 text-gray-700 dark:text-gray-200 truncate" title={key}>{key}</span>
              <span className="w-8 text-right font-mono text-gray-500 dark:text-gray-400">
                {total > 0 ? `${Math.round((n / total) * 100)}%` : ''}
              </span>
              <span className="w-10 text-right font-mono font-semibold text-gray-800 dark:text-gray-100">{n}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
