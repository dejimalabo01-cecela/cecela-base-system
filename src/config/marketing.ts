/**
 * マーケティング(反響管理)モジュールで使う選択肢の定義。
 * 値は DB に文字列のまま保存される（CHECK 制約と二重で UI 側でも検証する用途）。
 *
 * リストを変更する場合は、過去のデータが失われないよう旧ラベルを削除せず非表示にすること。
 */

export const INQUIRY_CATEGORIES = [
  '物件',
  'リード客',
  '紹介',
  '全般',
  '注文',
] as const;

export const INQUIRY_SOURCES = [
  'HP/メール',
  'HP/TEL',
  'HP/即時予約',
  'スーモ/メール',
  'スーモ/TEL',
  'スーモ/即時予約',
  '来店',
  'HP/資料請求',
  'HP/間取り集',
  'HP/施工事例',
  '既契約紹介',
  '業者紹介',
  '一般紹介',
  '社内紹介',
  'HP/注文',
  'スーモ注文/メール',
  'スーモ注文/TEL',
  'スーモカウンター',
  '月内問合せ',
  '現地',
  'チラシ',
  'KASIKA',
  'その他',
] as const;

export const INQUIRY_GA_SOURCES = [
  'Organic Search(Google)',
  'Organic Search(Yahoo!)',
  'Organic Search(Bing)',
  'Organic Social',
  'Paid Search(Google)',
  'Referral',
  'LINE',
  'LINE広告',
  'Email',
  '(direct) / (none)',
  '資料（ direct  )',
  '資料（ まちかど  )',
  '資料（施工事例集）',
  '資料（間取り集）',
  '資料（Meta物件広告）',
  '資料（LINE物件広告）',
  '資料（Google広告）',
  '資料（その他）',
  '間取り（direct)',
  '間取り（まちかど）',
  '間取り（施工事例集）',
  '間取り（間取り集）',
  '間取り（Meta物件広告）',
  '間取り（LINE物件広告）',
  '間取り（Google広告）',
  '間取り（その他）',
  'Meta広告（物件反響）',
  '不明',
] as const;

export const INQUIRY_AREAS = [
  '西宮市',
  '芦屋市',
  '宝塚・尼崎・伊丹市',
  '神戸市灘区',
  '神戸市東灘区',
  '神戸市北区',
  '神戸市兵庫区・長田区',
  '豊中市',
  '高槻市',
  '茨木市',
  '吹田市・池田市・川西市・摂津市',
  '媒介物件',
  'その他',
  '大阪市',
  '神戸市西区・須磨区・垂水区',
] as const;

// 選択肢が { value, label } 形式のもの
export const INQUIRY_EXISTING_CONTACT_OPTIONS = [
  { value: 'with',    label: '既存担当者あり' },
  { value: 'without', label: '既存担当者なし' },
] as const;

export const INQUIRY_CHANNEL_OPTIONS = [
  { value: 'tour', label: '見学' },
] as const;

export const INQUIRY_PRICE_STATUS_OPTIONS = [
  { value: 'undisclosed', label: '価格未定' },
  { value: 'public',      label: '価格公開中' },
] as const;

export const INQUIRY_FORMAT_OPTIONS = [
  { value: 'mobile-report', label: 'スマホレポート' },
  { value: 'mobile-koma',   label: 'スマホコマ'    },
  { value: 'pc-report',     label: 'PCレポート'    },
  { value: 'pc-koma',       label: 'PCコマ'        },
] as const;

export type InquiryExistingContact = typeof INQUIRY_EXISTING_CONTACT_OPTIONS[number]['value'];
export type InquiryChannel         = typeof INQUIRY_CHANNEL_OPTIONS[number]['value'];
export type InquiryPriceStatus     = typeof INQUIRY_PRICE_STATUS_OPTIONS[number]['value'];
export type InquiryFormat          = typeof INQUIRY_FORMAT_OPTIONS[number]['value'];

// ラベル変換ヘルパ（保存値→画面表示）
export function labelFor<T extends { value: string; label: string }>(
  options: readonly T[],
  value: string | null | undefined
): string {
  if (!value) return '';
  return options.find(o => o.value === value)?.label ?? value;
}
