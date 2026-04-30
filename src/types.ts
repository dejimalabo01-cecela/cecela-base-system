export interface Task {
  id: string;
  name: string;
  color: string;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;   // YYYY-MM-DD
  updatedAt: string | null;
  updatedBy: string | null;
  hidden: boolean;
}

// 販売計画モジュールで使う追加情報（既存機能は参照しない）
export type PropertyStatus =
  | '契約予定'
  | '契約済'
  | '期中完成販売'
  | '完成済'
  | 'R8年度完成'
  | '竣工予定日なし';

export type PropertyType =
  | '建売'
  | '条件付請負'
  | '条件付土地'
  | 'モデル'
  | '土地'
  | 'マンション'
  | '木賃収益'
  | '収益';

export const PROPERTY_STATUS_OPTIONS: PropertyStatus[] = [
  '契約予定', '契約済', '期中完成販売', '完成済', 'R8年度完成', '竣工予定日なし',
];

export const PROPERTY_TYPE_OPTIONS: PropertyType[] = [
  '建売', '条件付請負', '条件付土地', 'モデル', '土地', 'マンション', '木賃収益', '収益',
];

export interface Property {
  id: string;        // e.g. "P-001"
  name: string;
  createdAt: string; // ISO timestamp
  assigneeId: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  tasks: Task[];
  // 販売計画モジュール用（既存機能は未参照）
  propertyType?: PropertyType | null;
  status?: PropertyStatus | null;
  cost?: number | null;
  loan?: number | null;
  salePrice?: number | null;
  saleStartDate?: string | null;  // YYYY-MM-DD
  contractDate?: string | null;   // YYYY-MM-DD
  settlementDate?: string | null; // YYYY-MM-DD - 決済日
  pricePending?: boolean;
  salePriceUpdatedAt?: string | null;  // ISO timestamp - 販売価格が変わった日時
}

export interface TaskTemplate {
  id: string;
  name: string;
  color: string;
  orderIndex: number;
}

export interface Member {
  id: string;
  name: string;
}

export type UserRole = 'admin' | 'editor' | 'viewer' | 'assignee' | 'sales';

// マーケティング(反響管理) ─────────────────────────────────────────
// 個人情報（contactName / contactAddress）を含むため取扱注意。
export interface Inquiry {
  id: string;
  inquiryDate: string;            // YYYY-MM-DD
  inquiryTime: string | null;     // HH:MM
  category: string | null;        // 問合せカテゴリ
  source: string | null;          // 反響元
  gaSource: string | null;        // Googleアナリティクス
  existingContact: 'with' | 'without' | null;
  channel: 'tour' | null;
  propertyType: PropertyType | null;
  contactName: string | null;     // 問合せ者名前（個人情報）
  contactAddress: string | null;  // 問合せ者住所（個人情報）
  area: string | null;            // 反響物件エリア
  propertyId: string | null;      // 反響物件 ID
  salesperson: string | null;     // 営業担当
  priceStatus: 'undisclosed' | 'public' | null;
  format: 'mobile-report' | 'mobile-koma' | 'pc-report' | 'pc-koma' | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
}

// 新規作成・更新時に渡す部分集合（id / created_at 等は DB 側で生成）
export type InquiryInput = Omit<Inquiry, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>;

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  displayName?: string | null;
}

// サイドバーのモジュール定義
export type ModuleId = 'construction' | 'sales-management' | 'sales-plan' | 'marketing' | 'sales';

export interface AppModule {
  id: ModuleId;
  label: string;       // フルラベル
  shortLabel: string;  // タブ用の短いラベル
  iconName: string;    // Font Awesome icon name
  available: boolean;  // false = 準備中
}
