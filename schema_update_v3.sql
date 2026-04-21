-- ============================================================
-- Cecela schema_update_v3.sql
-- Supabase の SQL Editor で実行してください
-- ============================================================

-- 物件ごとに工程を非表示にできるフラグ
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;
