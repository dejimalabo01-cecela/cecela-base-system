-- ============================================================
-- Cecela schema_update_v12.sql
-- Supabase の SQL Editor で実行してください
--
-- マーケティング(反響管理)機能の追加：
--   - inquiries テーブル：問合せ／反響データを蓄積
--   - 個人情報を含むため admin/editor のみ書き込み可、viewer は閲覧可。
--     assignee / sales は marketing モジュールにそもそも入れないので除外。
-- ============================================================

CREATE TABLE IF NOT EXISTS inquiries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_date    DATE NOT NULL,                -- 反響日
  inquiry_time    TIME,                          -- 反響時刻
  category        TEXT,                          -- 問合せカテゴリ
  source          TEXT,                          -- 反響元
  ga_source       TEXT,                          -- Google アナリティクス
  existing_contact TEXT CHECK (existing_contact IN ('with','without') OR existing_contact IS NULL),  -- 既存担当者
  channel         TEXT CHECK (channel IN ('tour') OR channel IS NULL),                                -- 窓口
  property_type   TEXT,                          -- 種別（PropertyType）
  contact_name    TEXT,                          -- 問合せ者名前（個人情報）
  contact_address TEXT,                          -- 問合せ者住所（個人情報）
  area            TEXT,                          -- 反響物件エリア
  property_id     TEXT REFERENCES properties(id) ON UPDATE CASCADE ON DELETE SET NULL,
  salesperson     TEXT,                          -- 営業担当（暫定で free text）
  price_status    TEXT CHECK (price_status IN ('undisclosed','public') OR price_status IS NULL),
  format          TEXT CHECK (format IN ('mobile-report','mobile-koma','pc-report','pc-koma') OR format IS NULL),
  notes           TEXT,                          -- 備考
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ,
  created_by      TEXT,
  updated_by      TEXT
);

CREATE INDEX IF NOT EXISTS idx_inquiries_date        ON inquiries(inquiry_date DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_property_id ON inquiries(property_id);

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- SELECT: admin / editor / viewer
DROP POLICY IF EXISTS auth_inquiries_select ON inquiries;
CREATE POLICY auth_inquiries_select ON inquiries FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin','editor','viewer')
  )
);

-- INSERT / UPDATE / DELETE: admin / editor のみ
DROP POLICY IF EXISTS auth_inquiries_insert ON inquiries;
CREATE POLICY auth_inquiries_insert ON inquiries FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin','editor')
  )
);

DROP POLICY IF EXISTS auth_inquiries_update ON inquiries;
CREATE POLICY auth_inquiries_update ON inquiries FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin','editor')
  )
);

DROP POLICY IF EXISTS auth_inquiries_delete ON inquiries;
CREATE POLICY auth_inquiries_delete ON inquiries FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role IN ('admin','editor')
  )
);
