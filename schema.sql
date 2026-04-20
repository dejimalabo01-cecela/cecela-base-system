-- ============================================================
-- Cecela 物件管理システム - Supabase スキーマ
-- Supabase ダッシュボード > SQL Editor で実行してください
-- ============================================================

-- 物件テーブル
CREATE TABLE properties (
  id          TEXT PRIMARY KEY,       -- 'P-001', 'P-002' ...
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 工程タスクテーブル
CREATE TABLE tasks (
  id           TEXT NOT NULL,
  property_id  TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  start_date   DATE,
  end_date     DATE,
  order_index  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (property_id, id)
);

-- Row Level Security（ログインユーザーのみアクセス可）
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_properties_select" ON properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_properties_insert" ON properties FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_properties_update" ON properties FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_properties_delete" ON properties FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_tasks_select" ON tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_tasks_insert" ON tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_tasks_update" ON tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_tasks_delete" ON tasks FOR DELETE TO authenticated USING (true);
