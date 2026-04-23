-- ============================================================
-- Cecela schema_update_v4.sql
-- Supabase の SQL Editor で実行してください
--
-- 販売計画モジュールで使う追加フィールドを properties に追加。
-- すべて NULL 許容で、既存物件・既存機能には影響なし。
-- ============================================================

-- 物件種別（建売 / 条件付請負 / 条件付土地 / モデル / 土地 / マンション / 木賃収益 / 収益 など）
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_type TEXT;

-- 契約ステータス（契約予定 / 契約済 / 期中完成販売 / 完成済 / R8年度完成 / 竣工予定日なし など）
ALTER TABLE properties ADD COLUMN IF NOT EXISTS status TEXT;

-- 原価・借入・販売価格（円）
ALTER TABLE properties ADD COLUMN IF NOT EXISTS cost INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS loan INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS sale_price INTEGER;

-- 販売開始予定日 / 契約日
ALTER TABLE properties ADD COLUMN IF NOT EXISTS sale_start_date DATE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS contract_date DATE;

-- 販売価格が未確定かどうか（Excel の黄色塗りに相当）
ALTER TABLE properties ADD COLUMN IF NOT EXISTS price_pending BOOLEAN NOT NULL DEFAULT FALSE;
