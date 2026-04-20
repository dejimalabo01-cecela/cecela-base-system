-- ============================================================
-- Cecela schema_update_v2.sql
-- Supabase の SQL Editor で実行してください
-- ============================================================

-- ③ ユーザー権限テーブル
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor'
    CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 全認証ユーザーがプロフィール一覧を閲覧できる
CREATE POLICY "read_profiles" ON user_profiles
  FOR SELECT TO authenticated USING (true);

-- 自分のプロフィールを挿入できる（初回ログイン時の自動登録用）
CREATE POLICY "insert_own_profile" ON user_profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- 管理者は全プロフィールを更新できる（自分自身は除く）
CREATE POLICY "admin_update_profiles" ON user_profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 新規ユーザー登録時に自動でプロフィールを作成するトリガー
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'editor')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ⑤ 編集履歴カラム（物件）
ALTER TABLE properties ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- ⑤ 編集履歴カラム（工程）
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- ============================================================
-- ★ 上記を実行後、下記を別途実行して自分を管理者に設定してください
-- YOUR_EMAIL_HERE を自分のメールアドレスに書き換えてから実行
-- ============================================================
/*
INSERT INTO user_profiles (id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email = 'YOUR_EMAIL_HERE'
ON CONFLICT (id) DO UPDATE SET role = 'admin';
*/
