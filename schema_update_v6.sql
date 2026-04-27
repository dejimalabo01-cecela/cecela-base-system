-- ============================================================
-- Cecela schema_update_v6.sql
-- Supabase の SQL Editor で実行してください
--
-- 販売価格が更新された日時を記録するカラムを追加。
-- 「価格変更日」UIの表示ソースになる。NULL 許容で既存データは無傷。
-- ============================================================

ALTER TABLE properties ADD COLUMN IF NOT EXISTS sale_price_updated_at TIMESTAMPTZ;
