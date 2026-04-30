-- ============================================================
-- Cecela schema_update_v9.sql
-- Supabase の SQL Editor で実行してください
--
-- 「物件担当者(assignee)」も新規物件を登録できるようにするための RLS 強化。
--
-- これまで properties / tasks の INSERT・UPDATE・DELETE ポリシーは
--   USING (true) / WITH CHECK (true)
-- だったので「ログインしてさえいれば誰でも何でもできる」状態だった。
-- v8 の SELECT ポリシーで画面に出さない制御は入れたが、API 直叩きで
-- 他人の物件を書き換えることが理論上できてしまっていた。
--
-- このマイグレーションでロールごとに以下を強制する：
--   admin / editor   : 全物件の作成・編集・削除可
--   assignee         : 自分が assignee_id の物件のみ作成・編集可（削除は不可）
--   viewer / その他  : 書き込み不可
--
-- assignee の INSERT は assignee_id = auth.uid()::TEXT を必須にする
-- （他人を担当者にした物件を勝手に作ることを防ぐ）。
-- ============================================================

-- ── properties テーブル ────────────────────────────────────────

-- INSERT
DROP POLICY IF EXISTS auth_properties_insert ON properties;
CREATE POLICY auth_properties_insert ON properties FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin', 'editor')
        OR (up.role = 'assignee' AND properties.assignee_id = auth.uid()::TEXT)
      )
  )
);

-- UPDATE
DROP POLICY IF EXISTS auth_properties_update ON properties;
CREATE POLICY auth_properties_update ON properties FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin', 'editor')
        OR (up.role = 'assignee' AND properties.assignee_id = auth.uid()::TEXT)
      )
  )
);

-- DELETE（assignee は削除不可。誤操作防止のため admin / editor のみ）
DROP POLICY IF EXISTS auth_properties_delete ON properties;
CREATE POLICY auth_properties_delete ON properties FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'editor')
  )
);


-- ── tasks テーブル ─────────────────────────────────────────────

-- INSERT（自分が見られる物件にだけタスクを追加できる）
DROP POLICY IF EXISTS auth_tasks_insert ON tasks;
CREATE POLICY auth_tasks_insert ON tasks FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
      FROM properties p
      JOIN user_profiles up ON up.id = auth.uid()
     WHERE p.id = tasks.property_id
       AND (
         up.role IN ('admin', 'editor')
         OR (up.role = 'assignee' AND p.assignee_id = auth.uid()::TEXT)
       )
  )
);

-- UPDATE
DROP POLICY IF EXISTS auth_tasks_update ON tasks;
CREATE POLICY auth_tasks_update ON tasks FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
      FROM properties p
      JOIN user_profiles up ON up.id = auth.uid()
     WHERE p.id = tasks.property_id
       AND (
         up.role IN ('admin', 'editor')
         OR (up.role = 'assignee' AND p.assignee_id = auth.uid()::TEXT)
       )
  )
);

-- DELETE
DROP POLICY IF EXISTS auth_tasks_delete ON tasks;
CREATE POLICY auth_tasks_delete ON tasks FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
      FROM properties p
      JOIN user_profiles up ON up.id = auth.uid()
     WHERE p.id = tasks.property_id
       AND (
         up.role IN ('admin', 'editor')
         OR (up.role = 'assignee' AND p.assignee_id = auth.uid()::TEXT)
       )
  )
);
