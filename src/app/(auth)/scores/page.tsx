import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase'

export default async function ScoresPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: subjects } = await supabase
    .from('subjects')
    .select('*, class:classes(*)')
    .eq('teacher_id', user.id)
    .order('created_at')

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">บันทึกคะแนน</h1>
      <p className="text-sm text-slate-500 mb-6">เลือกรายวิชาและห้องเรียนที่ต้องการกรอกคะแนน</p>

      {subjects && subjects.length > 0 ? (
        <div className="grid grid-cols-2 gap-4">
          {subjects.map((s: any) => (
            <Link key={s.id} href={`/scores/${s.id}`}>
              <div className="card border-l-4 hover:shadow-md transition cursor-pointer group"
                style={{ borderLeftColor: s.color }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-lg group-hover:text-indigo-600 transition"
                      style={{ color: s.color }}>{s.name}</div>
                    <div className="text-sm text-slate-500 mt-0.5">ชั้น {s.class?.full_name}</div>
                  </div>
                  <span className="text-slate-300 group-hover:text-indigo-400 text-xl transition">→</span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex gap-3">
                  <span className="badge badge-indigo">เทอม 1</span>
                  <span className="badge badge-blue">เทอม 2</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">📭</div>
          <div className="font-semibold text-slate-600">ยังไม่มีรายวิชาที่ได้รับมอบหมาย</div>
          <div className="text-sm mt-1">กรุณาติดต่อ Admin เพื่อกำหนดรายวิชา</div>
        </div>
      )}
    </div>
  )
}
