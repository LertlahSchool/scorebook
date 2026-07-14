import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('*').eq('id', user.id).single()

  const isAdmin = profile?.role === 'admin'

  const [{ count: studentCount }, { count: teacherCount }, { count: scoreCount }] =
    await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
      supabase.from('scores').select('*', { count: 'exact', head: true }),
    ])

  const { data: mySubjects } = isAdmin ? { data: [] } : await supabase
    .from('subjects')
    .select('*, class:classes(*)')
    .eq('teacher_id', user.id)
    .order('created_at')

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">
        สวัสดี, {profile?.name} 👋
      </h1>
      <p className="text-sm text-slate-500 mb-6">ภาคเรียนที่ 1 ปีการศึกษา 2568</p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: isAdmin ? 'นักเรียนทั้งหมด' : 'วิชาที่สอน',
            value: isAdmin ? studentCount ?? 0 : mySubjects?.length ?? 0, color: '#4F46E5' },
          { label: isAdmin ? 'ครูในระบบ' : 'ห้องเรียน',
            value: isAdmin ? teacherCount ?? 0 : new Set(mySubjects?.map((s:any) => s.class_id)).size,
            color: '#F59E0B' },
          { label: 'รายการคะแนนที่บันทึก', value: scoreCount ?? 0, color: '#059669' },
        ].map((stat, i) => (
          <div key={i} className="card">
            <div className="w-10 h-1 rounded-full mb-3" style={{ background: stat.color }} />
            <div className="text-3xl font-bold text-slate-800">{stat.value}</div>
            <div className="text-sm text-slate-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Teacher: รายวิชา ── */}
      {!isAdmin && (
        <div className="card">
          <div className="card-title">📚 รายวิชาที่รับผิดชอบ</div>
          {mySubjects && mySubjects.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {mySubjects.map((s: any) => (
                <Link key={s.id} href={`/scores/${s.id}`}>
                  <div className="border-l-4 rounded-xl p-4 hover:shadow-md transition cursor-pointer bg-white border border-slate-100"
                    style={{ borderLeftColor: s.color }}>
                    <div className="font-bold" style={{ color: s.color }}>{s.name}</div>
                    <div className="text-sm text-slate-500">ชั้น {s.class?.full_name}</div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400">
              <div className="text-4xl mb-2">📭</div>
              <div>ยังไม่มีรายวิชาที่ได้รับมอบหมาย</div>
            </div>
          )}
        </div>
      )}

      {/* ── Admin: Quick links ── */}
      {isAdmin && (
        <div className="card">
          <div className="card-title">⚡ จัดการด่วน</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href:'/admin/students',   icon:'🎒', label:'จัดการนักเรียน',    sub:`${studentCount ?? 0} คน` },
              { href:'/admin/users',      icon:'👥', label:'จัดการผู้ใช้',      sub:`${teacherCount ?? 0} คน` },
              { href:'/admin/timetables', icon:'🖼️', label:'ตารางสอน',          sub:'อัปโหลดรายบุคคล' },
              { href:'/admin/overview',   icon:'📊', label:'ภาพรวมคะแนน',       sub:'เลือกวิชา/ห้อง' },
              { href:'/admin/export',     icon:'📥', label:'ส่งออกข้อมูล',      sub:`${scoreCount ?? 0} รายการ` },
            ].map(item => (
              <Link key={item.href} href={item.href}>
                <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition cursor-pointer">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <div className="font-semibold text-slate-700 text-sm">{item.label}</div>
                    <div className="text-xs text-slate-400">{item.sub}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
