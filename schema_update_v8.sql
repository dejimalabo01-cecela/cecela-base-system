-- ============================================================
-- Cecela schema_update_v8.sql
-- Supabase の SQL Editor で実行してください
--
-- 「物件担当者」ロールの導入：
--   - admin / editor / viewer / assignee の4ロール体制
--   - 物件担当者 (assignee) は自分が assigneeId に紐づく物件だけ閲覧・編集
--   - 既存の members テーブルは廃止し、担当者はユーザーとして管理
--
-- ⚠️ properties.assignee_id を全件 NULL に戻します。
--    既存の物件に担当者が割り当たっている場合、再割当が必要になります。
--    （まだ運用前の前提）
-- ============================================================

-- 1) ロールの選択肢に 'assignee' を追加
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'editor', 'viewer', 'assignee'));

-- 2) 表示名カラムを追加（メールアドレスの代わりに物件画面に出る名前）
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 3) members テーブルを廃止し、properties.assignee_id を NULL リセット
--    （以後 assignee_id には auth.users.id (UUID) を文字列として格納）
UPDATE properties SET assignee_id = NULL;
DROP TABLE IF EXISTS members CASCADE;

-- 4) RLS：SELECT を「ロールに応じて見える範囲」に制限
DROP POLICY IF EXISTS auth_properties_select ON properties;
CREATE POLICY auth_properties_select ON properties FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin', 'editor', 'viewer')
        OR (up.role = 'assignee' AND properties.assignee_id = auth.uid()::TEXT)
      )
  )
);

-- 5) tasks の SELECT も同じ範囲に揃える
DROP POLICY IF EXISTS auth_tasks_select ON tasks;
CREATE POLICY auth_tasks_select ON tasks FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
      FROM properties p
      JOIN user_profiles up ON up.id = auth.uid()
     WHERE p.id = tasks.property_id
       AND (
         up.role IN ('admin', 'editor', 'viewer')
         OR (up.role = 'assignee' AND p.assignee_id = auth.uid()::TEXT)
       )
  )
);
