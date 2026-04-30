import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    // 呼び出し元ユーザーの認証チェック
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: '認証が必要です' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: '認証失敗' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 管理者権限チェック
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: '管理者権限が必要です' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // リクエストボディからメール／ロール／表示名を取得
    const { email, role, displayName } = await req.json()
    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'メールアドレスが必要です' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ロールのバリデーション（デフォルトは assignee = 物件担当者）
    const validRoles = ['admin', 'editor', 'viewer', 'assignee']
    const inviteRole = validRoles.includes(role) ? role : 'assignee'
    const displayNameValue = (typeof displayName === 'string' && displayName.trim())
      ? displayName.trim()
      : null

    // 招待メール送信
    const siteUrl = Deno.env.get('SITE_URL') ?? ''
    const { data, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/`,
    })

    if (inviteError) {
      const msg = inviteError.message.includes('already been registered')
        ? 'このメールアドレスはすでに登録されています'
        : inviteError.message
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const invitedUserId = data.user?.id
    if (!invitedUserId) {
      return new Response(JSON.stringify({ error: 'ユーザーIDが取得できませんでした' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 指定されたロール・表示名で user_profiles を upsert
    await supabaseAdmin.from('user_profiles').upsert({
      id: invitedUserId,
      email: email,
      role: inviteRole,
      display_name: displayNameValue,
    })

    return new Response(JSON.stringify({ success: true, userId: invitedUserId, role: inviteRole }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
