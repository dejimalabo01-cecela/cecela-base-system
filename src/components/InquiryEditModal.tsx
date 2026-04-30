import { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faTrash } from '@fortawesome/free-solid-svg-icons';
import type { Inquiry, InquiryInput, Property } from '../types';
import { PROPERTY_TYPE_OPTIONS } from '../types';
import {
  INQUIRY_CATEGORIES,
  INQUIRY_SOURCES,
  INQUIRY_GA_SOURCES,
  INQUIRY_AREAS,
  INQUIRY_EXISTING_CONTACT_OPTIONS,
  INQUIRY_CHANNEL_OPTIONS,
  INQUIRY_PRICE_STATUS_OPTIONS,
  INQUIRY_FORMAT_OPTIONS,
} from '../config/marketing';

interface Props {
  inquiry: Inquiry | null;          // 編集対象（null なら新規）
  properties: Property[];           // 反響物件のドロップダウン用
  canEdit: boolean;                 // viewer は false
  onSave: (input: InquiryInput) => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
  onClose: () => void;
}

function emptyInput(): InquiryInput {
  // 入力初期値：今日の日付を既定にする
  const today = new Date().toISOString().slice(0, 10);
  return {
    inquiryDate:     today,
    inquiryTime:     null,
    category:        null,
    source:          null,
    gaSource:        null,
    existingContact: null,
    channel:         null,
    propertyType:    null,
    contactName:     null,
    contactAddress:  null,
    area:            null,
    propertyId:      null,
    salesperson:     null,
    priceStatus:     null,
    format:          null,
    notes:           null,
  };
}

function fromInquiry(i: Inquiry): InquiryInput {
  return {
    inquiryDate:     i.inquiryDate,
    inquiryTime:     i.inquiryTime,
    category:        i.category,
    source:          i.source,
    gaSource:        i.gaSource,
    existingContact: i.existingContact,
    channel:         i.channel,
    propertyType:    i.propertyType,
    contactName:     i.contactName,
    contactAddress:  i.contactAddress,
    area:            i.area,
    propertyId:      i.propertyId,
    salesperson:     i.salesperson,
    priceStatus:     i.priceStatus,
    format:          i.format,
    notes:           i.notes,
  };
}

export function InquiryEditModal({ inquiry, properties, canEdit, onSave, onDelete, onClose }: Props) {
  const isNew = inquiry === null;
  const [input, setInput] = useState<InquiryInput>(() => inquiry ? fromInquiry(inquiry) : emptyInput());
  const [saving, setSaving] = useState(false);
  const [propertySearch, setPropertySearch] = useState('');

  // 反響物件のフィルタ（ID または物件名で部分一致）
  const filteredProperties = useMemo(() => {
    const q = propertySearch.trim().toLowerCase();
    if (!q) return properties.slice(0, 50);
    return properties.filter(p =>
      p.id.toLowerCase().includes(q) || (p.name ?? '').toLowerCase().includes(q)
    ).slice(0, 50);
  }, [properties, propertySearch]);

  function set<K extends keyof InquiryInput>(key: K, value: InquiryInput[K]) {
    setInput(prev => ({ ...prev, [key]: value }));
  }

  // 文字列の select は空 → null
  function setStr<K extends keyof InquiryInput>(key: K, raw: string) {
    set(key, (raw === '' ? null : raw) as InquiryInput[K]);
  }

  async function handleSave() {
    if (!canEdit) return;
    if (!input.inquiryDate) {
      alert('日付を入力してください');
      return;
    }
    setSaving(true);
    const ok = await onSave(input);
    setSaving(false);
    if (ok) onClose();
  }

  async function handleDelete() {
    if (!onDelete || !canEdit) return;
    if (!confirm('この反響データを削除しますか？\n（取り消せません）')) return;
    setSaving(true);
    const ok = await onDelete();
    setSaving(false);
    if (ok) onClose();
  }

  const selectedProperty = properties.find(p => p.id === input.propertyId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {isNew ? '反響データを追加' : '反響データを編集'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
          >
            <FontAwesomeIcon icon={faXmark} className="text-lg" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── 日時 ── */}
          <Section title="日時">
            <div className="grid grid-cols-2 gap-3">
              <Field label="日付" required>
                <input
                  type="date"
                  value={input.inquiryDate ?? ''}
                  onChange={e => set('inquiryDate', e.target.value)}
                  disabled={!canEdit}
                  className={inputCls}
                />
              </Field>
              <Field label="時間">
                <input
                  type="time"
                  value={input.inquiryTime ?? ''}
                  onChange={e => set('inquiryTime', e.target.value || null)}
                  disabled={!canEdit}
                  className={inputCls}
                />
              </Field>
            </div>
          </Section>

          {/* ── 問合せ情報 ── */}
          <Section title="問合せ情報">
            <div className="grid grid-cols-2 gap-3">
              <Field label="問合せカテゴリ">
                <select
                  value={input.category ?? ''}
                  onChange={e => setStr('category', e.target.value)}
                  disabled={!canEdit}
                  className={selectCls}
                >
                  <option value="">未選択</option>
                  {INQUIRY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="反響元">
                <select
                  value={input.source ?? ''}
                  onChange={e => setStr('source', e.target.value)}
                  disabled={!canEdit}
                  className={selectCls}
                >
                  <option value="">未選択</option>
                  {INQUIRY_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Googleアナリティクス">
                <select
                  value={input.gaSource ?? ''}
                  onChange={e => setStr('gaSource', e.target.value)}
                  disabled={!canEdit}
                  className={selectCls}
                >
                  <option value="">未選択</option>
                  {INQUIRY_GA_SOURCES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="既存">
                <select
                  value={input.existingContact ?? ''}
                  onChange={e => setStr('existingContact', e.target.value)}
                  disabled={!canEdit}
                  className={selectCls}
                >
                  <option value="">未選択</option>
                  {INQUIRY_EXISTING_CONTACT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="窓口">
                <select
                  value={input.channel ?? ''}
                  onChange={e => setStr('channel', e.target.value)}
                  disabled={!canEdit}
                  className={selectCls}
                >
                  <option value="">未選択</option>
                  {INQUIRY_CHANNEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="種別">
                <select
                  value={input.propertyType ?? ''}
                  onChange={e => setStr('propertyType', e.target.value)}
                  disabled={!canEdit}
                  className={selectCls}
                >
                  <option value="">未選択</option>
                  {PROPERTY_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          {/* ── 反響者（個人情報） ── */}
          <Section title="反響者情報" hint="※ 個人情報。取扱注意">
            <div className="grid grid-cols-1 gap-3">
              <Field label="問合せ者名前">
                <input
                  type="text"
                  value={input.contactName ?? ''}
                  onChange={e => setStr('contactName', e.target.value)}
                  disabled={!canEdit}
                  placeholder="山田 太郎"
                  className={inputCls}
                />
              </Field>
              <Field label="問合せ者住所">
                <input
                  type="text"
                  value={input.contactAddress ?? ''}
                  onChange={e => setStr('contactAddress', e.target.value)}
                  disabled={!canEdit}
                  placeholder="兵庫県西宮市..."
                  className={inputCls}
                />
              </Field>
            </div>
          </Section>

          {/* ── 反響物件 ── */}
          <Section title="反響物件">
            <div className="grid grid-cols-2 gap-3">
              <Field label="エリア">
                <select
                  value={input.area ?? ''}
                  onChange={e => setStr('area', e.target.value)}
                  disabled={!canEdit}
                  className={selectCls}
                >
                  <option value="">未選択</option>
                  {INQUIRY_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="価格状況">
                <select
                  value={input.priceStatus ?? ''}
                  onChange={e => setStr('priceStatus', e.target.value)}
                  disabled={!canEdit}
                  className={selectCls}
                >
                  <option value="">未選択</option>
                  {INQUIRY_PRICE_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>
            <Field label="反響物件" hint="物件IDまたは名前で検索">
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={propertySearch}
                  onChange={e => setPropertySearch(e.target.value)}
                  disabled={!canEdit}
                  placeholder="例：001 / 西宮"
                  className={inputCls}
                />
                <select
                  value={input.propertyId ?? ''}
                  onChange={e => setStr('propertyId', e.target.value)}
                  disabled={!canEdit}
                  size={Math.min(6, Math.max(3, filteredProperties.length))}
                  className={selectCls + ' w-full'}
                >
                  <option value="">未選択</option>
                  {filteredProperties.map(p => (
                    <option key={p.id} value={p.id}>{p.id} - {p.name}</option>
                  ))}
                </select>
                {selectedProperty && (
                  <p className="text-[11px] text-blue-600 dark:text-blue-400">
                    選択中：{selectedProperty.id} - {selectedProperty.name}
                  </p>
                )}
              </div>
            </Field>
          </Section>

          {/* ── 営業 ── */}
          <Section title="営業情報">
            <div className="grid grid-cols-2 gap-3">
              <Field label="担当（営業）" hint="後で「営業」モジュールと連携予定（暫定で自由入力）">
                <input
                  type="text"
                  value={input.salesperson ?? ''}
                  onChange={e => setStr('salesperson', e.target.value)}
                  disabled={!canEdit}
                  placeholder="例：田中"
                  className={inputCls}
                />
              </Field>
              <Field label="コマorレポート">
                <select
                  value={input.format ?? ''}
                  onChange={e => setStr('format', e.target.value)}
                  disabled={!canEdit}
                  className={selectCls}
                >
                  <option value="">未選択</option>
                  {INQUIRY_FORMAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          {/* ── 備考 ── */}
          <Section title="備考">
            <textarea
              value={input.notes ?? ''}
              onChange={e => setStr('notes', e.target.value)}
              disabled={!canEdit}
              rows={3}
              placeholder="自由記入"
              className={inputCls + ' resize-y'}
            />
          </Section>
        </div>

        {/* ── フッター ── */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
          <div>
            {!isNew && onDelete && canEdit && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="text-sm px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition flex items-center gap-1.5"
              >
                <FontAwesomeIcon icon={faTrash} className="text-xs" />
                削除
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="text-sm px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              {canEdit ? 'キャンセル' : '閉じる'}
            </button>
            {canEdit && (
              <button
                onClick={handleSave}
                disabled={saving || !input.inquiryDate}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-5 py-2 transition"
              >
                {saving ? '保存中…' : '保存'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 内部ヘルパー ────────────────────────────────────────────────

const inputCls  = 'w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60';
const selectCls = inputCls;

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">{title}</h3>
        {hint && <span className="text-[11px] text-amber-600 dark:text-amber-400">{hint}</span>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
        {hint && <span className="text-[10px] text-gray-400 dark:text-gray-500">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
