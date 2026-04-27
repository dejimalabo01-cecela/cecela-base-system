-- ============================================================
-- Cecela schema_update_v7.sql
-- Supabase の SQL Editor で実行してください
--
-- 「販売管理」モジュール用に決済日カラムを追加。
-- 既存物件・既存機能は影響なし（NULL 許容）。
-- ============================================================

ALTER TABLE properties ADD COLUMN IF NOT EXISTS settlement_date DATE;
