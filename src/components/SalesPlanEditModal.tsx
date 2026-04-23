import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faLink } from '@fortawesome/free-solid-svg-icons';
import type { Property, PropertyStatus, PropertyType } from '../types';
import { PROPERTY_STATUS_OPTIONS, PROPERTY_TYPE_OPTIONS } from '../types';
import { findSaleTask, getSaleStartDate, getSaleStartSource } from '../utils/salesHelpers';

interface Props {
  property: Property;
  onSave: (
    updates: Partial<Pick<Property,
      'propertyType' | 'status' | 'cost' | 'loan' | 'salePrice' |
      'saleStartDate' | 'contractDate' | 'pricePending'
    >>
  ) => Promise<void>;
  onClose: () => void;
}

export function SalesPlanEditModal({ property, onSave, onClose }: Props) {
  const [propertyType, setPropertyType] = useState<PropertyType | ''>(property.propertyType ?? '');
  const [status, setStatus] = useState<PropertyStatus | ''>(property.status ?? '');
  const [cost, setCost] = useState<string>(property.cost != null ? String(property.cost) : '');
  const [loan, setLoan] = useState<string>(property.loan != null ? String(property.loan) : '');
  const [salePrice, setSalePrice] = useState<string>(property.salePrice != null ? String(property.salePrice) : '');
  const [contractDate, setContractDate] = useState<string>(property.contractDate ?? '');
  const [pricePending, setPricePending] = useState<boolean>(property.pricePending ?? false);
  const [saving, setSaving] = useState(false);

  // 販売開始日は工程管理の「販売」タスクから自動取得（フォールバックで property.saleStartDate）
  const saleTask = findSaleTask(property);
  const saleStartDate = getSaleStartDate(property);
  const saleSource = getSaleStartSource(property);

  const toNum = (v: string): number | null => {
    const n = parseInt(v.replace(/[,\s]/g, ''), 10);
    return Number.isFinite(n) ? n : null;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        propertyType: propertyType || null,
        status: status || null,
        cost: cost.trim() === '' ? null : toNum(cost),
        loan: loan.trim() === '' ? null : toNum(loan),
        salePrice: salePrice.trim() === '' ? null : toNum(salePrice),
        contractDate: contractDate || null,
        pricePending,
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

          {/* 契約ステータス */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">契約ステータス</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as PropertyStatus | '')}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
            >
              <option value="">未設定</option>
              {PROPERTY_STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
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

          {/* 計算表示（原価×15% / 自己資金） */}
          {(computedBuffer != null || ownFund != null) && (
            <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded px-3 py-2 space-y-0.5">
              <div>原価 × 15% ＝ <span className="font-mono text-gray-700 dark:text-gray-300">{fmt(computedBuffer)}</span></div>
              <div>差額（自己資金）＝ <span className="font-mono text-gray-700 dark:text-gray-300">{fmt(ownFund)}</span></div>
            </div>
          )}

          {/* 販売価格 + 未確定 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">販売価格（円）</label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={salePrice}
                onChange={e => setSalePrice(e.target.value)}
                placeholder="例: 78000000"
                className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
              />
              <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg px-3">
                <input
                  type="checkbox"
                  checked={pricePending}
                  onChange={e => setPricePending(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
                />
                未確定
              </label>
            </div>
          </div>

          {/* 販売開始日（自動取得・読取専用） */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1.5">
              販売開始日
              <FontAwesomeIcon icon={faLink} className="text-[10px] text-blue-500" />
              <span className="text-[10px] font-normal text-blue-500">工程管理から自動取得</span>
            </label>
            <div className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 flex items-center justify-between">
              <span className="font-mono">{saleStartDate || '未設定'}</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                {saleSource === 'task' && saleTask && `← 工程「${saleTask.name}」`}
                {saleSource === 'fallback' && '← 手動入力'}
                {saleSource === 'none' && '工程管理に「販売」タスクが見つかりません'}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
              変更したい場合は、工程管理でこの物件の「販売」工程の開始日を編集してください。
            </p>
          </div>

          {/* 契約日 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">契約日</label>
            <input
              type="date"
              value={contractDate}
              onChange={e => setContractDate(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
            />
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
