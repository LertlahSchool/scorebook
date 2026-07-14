'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export default function TimetablePage() {
  const supabase = createClient()
  const [profile,   setProfile]   = useState<any>(null)
  const [timetable, setTimetable] = useState<any>(null)
  const [imageUrl,  setImageUrl]  = useState<string | null>(null)
  const [subjects,  setSubjects]  = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: prof }, { data: tt }, { data: subj }] = await Promise.all([
        supabase.from('users').select('name').eq('id', user.id).single(),
        supabase.from('timetables').select('*').eq('teacher_id', user.id).single(),
        supabase.from('subjects').select('*, class:classes(*)').eq('teacher_id', user.id).order('created_at'),
      ])

      setProfile(prof)
      setTimetable(tt)
      setSubjects(subj || [])

      if (tt?.image_url) {
        const { data: signed } = await supabase.storage
          .from('timetables').createSignedUrl(tt.image_url, 60 * 60)
        setImageUrl(signed?.signedUrl || null)
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleDownload = async () => {
    if (!imageUrl || !timetable) return
    setDownloading(true)
    try {
      const res  = await fetch(imageUrl)
      const blob = await res.blob()
      const ext  = timetable.file_name?.split('.').pop() || 'png'
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `ตารางสอน_${profile?.name || 'ครู'}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // fallback: open in new tab
      window.open(imageUrl, '_blank')
    }
    setDownloading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-slate-400">กำลังโหลด...</div>
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">ตารางสอน</h1>
      <p className="text-sm text-slate-500 mb-6">ตารางสอนของคุณในภาคเรียนนี้</p>

      <div className="card mb-5">
        {/* Card header with download button */}
        <div className="flex items-center justify-between mb-4">
          <div className="card-title mb-0">📅 ตารางสอน — {profile?.name}</div>
          {imageUrl && (
            <button
              className="btn-secondary btn-sm flex items-center gap-1.5"
              onClick={handleDownload}
              disabled={downloading}>
              {downloading ? '⏳ กำลังดาวน์โหลด...' : '⬇️ ดาวน์โหลดรูปตาราง'}
            </button>
          )}
        </div>

        {imageUrl ? (
          <div>
            <img src={imageUrl} alt="ตารางสอน" className="w-full rounded-xl border border-slate-100" />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                ไฟล์: {timetable?.file_name || '—'}
              </span>
              <span className="text-xs text-slate-400">
                อัปโหลดเมื่อ {new Date(timetable?.uploaded_at).toLocaleDateString('th-TH', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-2xl p-14 text-center text-slate-400 border-2 border-dashed border-slate-200">
            <div className="text-5xl mb-3">📭</div>
            <div className="font-semibold text-slate-500 mb-1">ยังไม่มีตารางสอน</div>
            <div className="text-sm">Admin ยังไม่ได้อัปโหลดตารางสอนให้คุณ</div>
          </div>
        )}
      </div>

      {/* My subjects */}
      <div className="card">
        <div className="card-title">📚 รายวิชาที่รับผิดชอบ</div>
        {subjects.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {subjects.map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
                <div>
                  <div className="font-semibold text-sm text-slate-700">{s.name}</div>
                  <div className="text-xs text-slate-400">ชั้น {s.class?.full_name}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-slate-400 text-sm text-center py-6">ยังไม่มีรายวิชา</div>
        )}
      </div>
    </div>
  )
}
