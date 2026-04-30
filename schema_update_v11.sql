-- ============================================================
-- Cecela schema_update_v11.sql
-- Supabase の SQL Editor で実行してください
--
-- 「販売管理担当者(sales)」ロールの追加：
--   - 5ロール体制：admin / editor / viewer / assignee / sales
--   - sales は販売管理画面のみ編集可。工程管理・販売計画は不可。
--   - properties は SELECT / UPDATE 可（販売情報の更新用）。
--     物件の追加・削除はできない。
--   - tasks は閲覧のみ可（販売管理画面でも工程の最新日付を参照する場合があるため
--     SELECT は通すが、INSERT / UPDATE / DELETE は不可）。
--
--   ※ 列単位の権限制御は Postgres RLS だけでは難しいため、
--     「販売管理画面以外のフィールド変更」を防ぐのは UI 側の責務とする。
--     必要なら BEFORE UPDATE トリガーで列の変更を拒否する強化も可能。
-- ============================================================

-- 1) ロールの選択肢に 'sales' を追加
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'editor', 'viewer', 'assignee', 'sales'));

-- 2) properties SELECT：sales は全件閲覧可
DROP POLICY IF EXISTS auth_properties_select ON properties;
CREATE POLICY auth_properties_select ON properties FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin', 'editor', 'viewer', 'sales')
        OR (up.role = 'assignee' AND properties.assignee_id = auth.uid()::TEXT)
      )
  )
);

-- 3) tasks SELECT：sales も閲覧可（販売管理画面で工程を参照することがあるため）
DROP POLICY IF EXISTS auth_tasks_select ON tasks;
CREATE POLICY auth_tasks_select ON tasks FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
      FROM properties p
      JOIN user_profiles up ON up.id = auth.uid()
     WHERE p.id = tasks.property_id
       AND (
         up.role IN ('admin', 'editor', 'viewer', 'sales')
         OR (up.role = 'assignee' AND p.assignee_id = auth.uid()::TEXT)
       )
  )
);

-- 4) properties UPDATE：sales も全件更新可（販売情報の更新用）
DROP POLICY IF EXISTS auth_properties_update ON properties;
CREATE POLICY auth_properties_update ON properties FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin', 'editor', 'sales')
        OR (up.role = 'assignee' AND properties.assignee_id = auth.uid()::TEXT)
      )
  )
);

-- 5) properties INSERT：sales は不可（admin/editor、assignee は自分名義のみ可）
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

-- 6) properties DELETE：sales は不可（v9 と同じ。明示的に再宣言）
DROP POLICY IF EXISTS auth_properties_delete ON properties;
CREATE POLICY auth_properties_delete ON properties FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'editor')
  )
);

-- 7) tasks INSERT/UPDATE/DELETE：sales は不可（v9 のポリシーから sales を除外）
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
