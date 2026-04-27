import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faLink, faClock, faTags } from '@fortawesome/free-solid-svg-icons';
import type { Property, PropertyType } from '../types';
import { PROPERTY_TYPE_OPTIONS } from '../types';
import { findSaleTask, getSaleStartDate, getSaleStartSource } from '../utils/salesHelpers';

type UpdateIdResult = { ok: true } | { ok: false; reason: 'invalid' | 'duplicate' | 'notfound' | 'db' };

interface Props {
  property: Property;
  isAdmin: boolean;
  onSaveSalesInfo: (
    updates: Partial<Pick<Property,
      'propertyType' | 'cost' | 'loan'
    >>
  ) => Promise<void>;
  onUpdatePropertyName: (name: string) => Promise<void>;
  onUpdatePropertyId: (newId: string) => Promise<UpdateIdResult>;
  onClose: () => void;
}

function statusBadgeColor(s: string | null | undefined): string {
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

export function SalesPlanEditModal({
  property, isAdmin,
  onSaveSalesInfo, onUpdatePropertyName, onUpdatePropertyId,
  onClose,
}: Props) {
  const [propertyId, setPropertyId] = useState<string>(property.id);
  const [propertyName, setPropertyName] = useState<string>(property.name);
  const [propertyType, setPropertyType] = useState<PropertyType | ''>(property.propertyType ?? '');
  const [cost, setCost] = useState<string>(property.cost != null ? String(property.cost) : '');
  const [loan, setLoan] = useState<string>(property.loan != null ? String(property.loan) : '');
  const [saving, setSaving] = useState(false);

  // 販売開始日は工程管理の「販売」タスクから自動取得（フォールバックで property.saleStartDate）
  const saleTask = findSaleTask(property);
  const saleStartDate = getSaleStartDate(property);
  const saleSource = getSaleStartSource(property);

  const toNum = (v: string): number | null => {
    const n = parseInt(v.replace(/[,\s]/g, ''), 10);
    return Number.isFinite(n) ? n : null;
  };

  function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // 1) 物件ID変更（admin限定、既存と違うときだけ）
      const trimmedId = propertyId.trim();
      if (isAdmin && trimmedId && trimmedId !== property.id) {
        const result = await onUpdatePropertyId(trimmedId);
        if (!result.ok) {
          const messages: Record<typeof result.reason, string> = {
            invalid:   '物件IDに使用できない文字が含まれています。英数字 / . / - / _ のみ使えます。',
            duplicate: `物件ID「${trimmedId}」は既に他の物件で使われています。`,
            notfound:  '対象の物件が見つかりません。',
            db:        '物件IDの保存に失敗しました（schema_update_v5.sql は実行済みですか？）。',
          };
          alert(messages[result.reason]);
          return;
        }
      }

      // 2) 物件名変更（変わったときだけ）
      const trimmedName = propertyName.trim();
      if (trimmedName && trimmedName !== property.name) {
        await onUpdatePropertyName(trimmedName);
      }

      // 3) 販売情報の保存（種別・原価・借入のみ。
      //    販売価格・ステータス・契約日・決済日は「販売管理」モジュールで編集する。）
      await onSaveSalesInfo({
        propertyType: propertyType || null,
        cost: cost.trim() === '' ? null : toNum(cost),
        loan: loan.trim() === '' ? null : toNum(loan),
      });

      onClose();
    } finally {
      setSaving(false);
    }
  }

  const costVal = toNum(cost);
  const computedBuffer = costVal != null ? Math.round(costVal * 0.15) : null;
  const loanVal = toNum(loan);
  const ownFund = costVal != null && loanVal != null ? costVal - loanVal : null;
  const fmt = (n: number | null) => n != null ? n.toLocaleString('ja-JP') + ' 円' : '―';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 truncate">販売計画の編集</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{property.id} · {property.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition shrink-0">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* 物件ID / 物件名 */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                物件ID {!isAdmin && <span className="text-[10px] font-normal text-gray-400">(admin専用)</span>}
              </label>
              <input
                type="text"
                value={propertyId}
                onChange={e => setPropertyId(e.target.value)}
                disabled={!isAdmin}
                placeholder="例: 003.1"
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-900/50 disabled:cursor-not-allowed font-mono"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">物件名</label>
              <input
                type="text"
                value={propertyName}
                onChange={e => setPropertyName(e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
              />
            </div>
          </div>
          <p className="text-[10px] text-blue-500 -mt-3 flex items-center gap-1">
            <FontAwesomeIcon icon={faLink} />
            ID・物件名の変更は工程管理にも反映されます
          </p>

          {/* 物件種別 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">物件種別</label>
            <select
              value={propertyType}
              onChange={e => setPropertyType(e.target.value as PropertyType | '')}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
            >
              <option value="">未設定</option>
              {PROPERTY_TYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          {/* 原価 / 借入 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">原価（円）</label>
              <input
                type="text"
                inputMode="numeric"
                value={cost}
                onChange={e => setCost(e.target.value)}
                placeholder="例: 50000000"
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">借入（円）</label>
              <input
                type="text"
                inputMode="numeric"
                value={loan}
                onChange={e => setLoan(e.target.value)}
                placeholder="例: 40000000"
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          {(computedBuffer != null || ownFund != null) && (
            <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded px-3 py-2 space-y-0.5">
              <div>原価 × 15% ＝ <span className="font-mono text-gray-700 dark:text-gray-300">{fmt(computedBuffer)}</span></div>
              <div>差額（自己資金）＝ <span className="font-mono text-gray-700 dark:text-gray-300">{fmt(ownFund)}</span></div>
            </div>
          )}

          {/* 販売管理から取得する項目（読み取り専用表示） */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900/40">
            <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-1.5">
              <FontAwesomeIcon icon={faTags} className="text-blue-500" />
              販売情報（販売管理で編集）
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">販売開始日</div>
                <div className="font-mono text-gray-700 dark:text-gray-200">
                  {saleStartDate || '未設定'}
                  <span className="text-[10px] text-gray-400 ml-1">
                    {saleSource === 'task' && saleTask && `← 工程「${saleTask.name}」`}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">販売価格</div>
                <div className={`font-mono ${property.pricePending ? 'text-yellow-700 dark:text-yellow-300' : 'text-gray-700 dark:text-gray-200'}`}>
                  {property.salePrice != null ? property.salePrice.toLocaleString('ja-JP') + ' 円' : '未設定'}
                  {property.pricePending && <span className="ml-1 text-[10px]">（未確定）</span>}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">契約ステータス</div>
                <div>
                  {property.status ? (
                    <span className={`inline-block text-[10px] px-2 py-0.5 rounded ${statusBadgeColor(property.status)}`}>{property.status}</span>
                  ) : (
                    <span className="text-gray-400">未設定</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">契約日</div>
                <div className="font-mono text-gray-700 dark:text-gray-200">{property.contractDate ?? '未設定'}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">決済日</div>
                <div className="font-mono text-gray-700 dark:text-gray-200">{property.settlementDate ?? '未設定'}</div>
              </div>
              {property.salePriceUpdatedAt && (
                <div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <FontAwesomeIcon icon={faClock} className="text-[9px]" />
                    価格変更日
                  </div>
                  <div className="font-mono text-gray-600 dark:text-gray-300 text-[11px]">
                    {formatDateTime(property.salePriceUpdatedAt)}
                  </div>
                </div>
              )}
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2">
              これらの項目は左メニューの「販売管理」で編集してください。
            </p>
          </div>
        </form>

        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 hover:border-gray-400 rounded-lg px-4 py-2 transition"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="text-sm text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg px-4 py-2 transition"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
