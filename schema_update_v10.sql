-- ============================================================
-- Cecela schema_update_v10.sql
-- Supabase の SQL Editor で実行してください
--
-- v9 で物件担当者(assignee) の INSERT を許可したが、新規IDの採番がクライアント側で
-- 「自分が見える物件」だけを基準に行われていたため、admin が作った既存物件と
-- ID が衝突して INSERT が PK 違反でサイレントに失敗していた。
--
-- ここで「全物件にアクセスして次のIDを返す」SECURITY DEFINER 関数を作る。
-- SECURITY DEFINER で関数所有者の権限で動くため、呼び出した authenticated ユーザーの
-- RLS をバイパスして全行を見られる（採番のためだけに必要な情報）。
-- ============================================================

CREATE OR REPLACE FUNCTION public.next_property_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_n INTEGER;
BEGIN
  -- 既存IDの先頭整数部分（"P-001" / "001" / "003.1" すべて対応）の最大値を求める
  SELECT COALESCE(
    MAX(((REGEXP_MATCH(id, '^P?-?([0-9]+)'))[1])::INTEGER),
    0
  )
  INTO max_n
  FROM properties;

  RETURN LPAD((max_n + 1)::TEXT, 3, '0');
END;
$$;

-- 一般ユーザーが直接 EXECUTE できないよう PUBLIC は剥がし、authenticated にのみ付与
REVOKE ALL ON FUNCTION public.next_property_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_property_id() TO authenticated;
