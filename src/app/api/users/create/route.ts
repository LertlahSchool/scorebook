import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  // ตรวจสอบว่าเป็น admin
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, password, name, role } = await req.json()
  if (!email || !password || !name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // ใช้ Service Role Key เพื่อสร้าง user ใหม่
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: newUser, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error || !newUser.user) {
    return NextResponse.json({ error: error?.message || 'สร้างผู้ใช้ไม่สำเร็จ' }, { status: 400 })
  }

  // Insert profile
  const { error: profileError } = await adminClient.from('users').insert({
    id:     newUser.user.id,
    email,
    name,
    role:   role || 'teacher',
    avatar: name.charAt(2) || name.charAt(0),
  })

  if (profileError) {
    // rollback: ลบ auth user
    await adminClient.auth.admin.deleteUser(newUser.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json({ userId: newUser.user.id })
}
