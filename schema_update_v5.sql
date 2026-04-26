-- ============================================================
-- Cecela schema_update_v5.sql
-- Supabase の SQL Editor で実行してください
--
-- 物件IDの編集を可能にするため、tasks → properties の外部キーに
-- ON UPDATE CASCADE を追加。これにより properties.id を変更すると
-- tasks.property_id も自動的に追随します。
-- 既存データは無傷。
-- ============================================================

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_property_id_fkey;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES properties(id)
  ON DELETE CASCADE
  ON UPDATE CASCADE;
