-- ============================================================
-- Cecela 物件管理システム - スキーマ追加
-- Supabase ダッシュボード > SQL Editor で実行してください
-- ============================================================

-- 工程テンプレートテーブル
CREATE TABLE task_templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#6B7280',
  order_index INTEGER NOT NULL DEFAULT 0
);

-- デフォルト工程を投入
INSERT INTO task_templates (id, name, color, order_index) VALUES
  ('tt-0', 'PJ設定期日',               '#10B981', 0),
  ('tt-1', '仕入れ決済日',             '#059669', 1),
  ('tt-2', '解体工事',                 '#EF4444', 2),
  ('tt-3', '造成工事',                 '#F59E0B', 3),
  ('tt-4', '上下水・ガス引込・道路復旧', '#3B82F6', 4),
  ('tt-5', 'プラン作成',               '#8B5CF6', 5),
  ('tt-6', '建築確認',                 '#06B6D4', 6),
  ('tt-7', '建築工事（外構含む）',      '#F97316', 7),
  ('tt-8', '販売',                     '#EC4899', 8);

-- 担当者テーブル
CREATE TABLE members (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 既存テーブルに列追加
ALTER TABLE tasks ADD COLUMN color TEXT NOT NULL DEFAULT '#6B7280';
ALTER TABLE properties ADD COLUMN assignee_id TEXT REFERENCES members(id) ON DELETE SET NULL;

-- 既存タスクのカラーを名前から設定
UPDATE tasks SET color = '#10B981' WHERE name = 'PJ設定期日';
UPDATE tasks SET color = '#059669' WHERE name = '仕入れ決済日';
UPDATE tasks SET color = '#EF4444' WHERE name = '解体工事';
UPDATE tasks SET color = '#F59E0B' WHERE name = '造成工事';
UPDATE tasks SET color = '#3B82F6' WHERE name = '上下水・ガス引込・道路復旧';
UPDATE tasks SET color = '#8B5CF6' WHERE name = 'プラン作成';
UPDATE tasks SET color = '#06B6D4' WHERE name = '建築確認';
UPDATE tasks SET color = '#F97316' WHERE name = '建築工事（外構含む）';
UPDATE tasks SET color = '#EC4899' WHERE name = '販売';

-- RLS設定
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE members        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_task_templates_select" ON task_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_task_templates_insert" ON task_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_task_templates_update" ON task_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_task_templates_delete" ON task_templates FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_members_select" ON members FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_members_insert" ON members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_members_update" ON members FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_members_delete" ON members FOR DELETE TO authenticated USING (true);
