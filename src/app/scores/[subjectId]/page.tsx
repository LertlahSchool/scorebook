'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getGrade } from '@/lib/utils'
import type { Student, Score } from '@/types'

export default function ScoreEntryPage() {
  const { subjectId } = useParams<{ subjectId: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [subject, setSubject] = useState<any>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [scores, setScores]   = useState<Record<string, number | null>>({}) // studentId → score
  const [draft, setDraft]     = useState<Record<string, string>>({})
  const [semester, setSemester] = useState<1 | 2>(1)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [userId, setUserId]   = useState<string>('')

  // โหลดข้อมูล
  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)

    // ดึง subject
    const { data: subj } = await supabase
      .from('subjects')
      .select('*, class:classes(*)')
      .eq('id', subjectId)
      .single()
    setSubject(subj)

    if (!subj) return

    // ดึงนักเรียน
    const { data: sts } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', subj.class_id)
      .order('no')
    setStudents(sts || [])

    // ดึงคะแนน
    const { data: sc } = await supabase
      .from('scores')
      .select('*')
      .eq('subject_id', subjectId)
      .eq('semester', semester)
    const scoreMap: Record<string, number | null> = {}
    sc?.forEach((s: Score) => { scoreMap[s.student_id] = s.score })
    setScores(scoreMap)
    setDraft({})
  }, [subjectId, semester])

  useEffect(() => { loadData() }, [loadData])

  const handleSave = async () => {
    if (Object.keys(draft).length === 0) return
    setSaving(true)
    const upsertRows = Object.entries(draft)
      .filter(([, v]) => v !== '')
      .map(([studentId, v]) => ({
        student_id: studentId,
        subject_id: subjectId,
        semester,
        score: Number(v),
        updated_by: userId,
      }))

    await supabase.from('scores').upsert(upsertRows, {
      onConflict: 'student_id,subject_id,semester',
    })

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    await loadData()
  }

  const hasDraft = Object.keys(draft).length > 0

  if (!subject) return (
    <div className="flex items-center justify-center h-40 text-slate-400">กำลังโหลด...</div>
  )

  return (
    <div>
      <button onClick={() => router.back()}
        className="btn-secondary btn-sm mb-5">← กลับ</button>

      <h1 className="text-xl font-bold text-slate-800 mb-1">
        {subject.name} — ชั้น {subject.class?.full_name}
      </h1>
      <p className="text-sm text-slate-500 mb-5">
        บันทึกคะแนนรายเทอม (เต็ม 100 คะแนน)
      </p>

      {/* Semester tabs */}
      <div className="flex gap-2 mb-5">
        {([1, 2] as const).map(s => (
          <button key={s}
            className={`px-6 py-2 rounded-xl text-sm font-semibold transition ${
              semester === s
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'
            }`}
            onClick={() => { setSemester(s); setDraft({}) }}>
            เทอม {s}
          </button>
        ))}
      </div>

      {/* Unsaved warning */}
      {hasDraft && (
        <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-4">
          <span className="text-sm text-indigo-600 font-medium">⚠️ มีการแก้ไขที่ยังไม่ได้บันทึก</span>
          <button className="btn-indigo btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึกคะแนน'}
          </button>
        </div>
      )}

      {/* Score table */}
      <div className="card p-0 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-12">ที่</th>
              <th>ชื่อ-นามสกุล</th>
              <th>รหัสนักเรียน</th>
              <th className="text-center">คะแนนเทอม {semester} /100</th>
              <th className="text-center">เกรด</th>
            </tr>
          </thead>
          <tbody>
            {students.map(st => {
              const draftVal = draft[st.id]
              const savedVal = scores[st.id] ?? null
              const displayVal = draftVal !== undefined ? draftVal : (savedVal !== null ? String(savedVal) : '')
              const numVal = displayVal === '' ? null : Number(displayVal)
              const grade = getGrade(numVal)
              return (
                <tr key={st.id}>
                  <td className="text-slate-400 text-center">{st.no}</td>
                  <td className="font-medium">{st.name}</td>
                  <td className="text-slate-400 text-sm">{st.student_code || '—'}</td>
                  <td>
                    <input
                      className="score-input"
                      type="number" min={0} max={100}
                      value={displayVal}
                      placeholder="—"
                      onChange={e => {
                        let v = e.target.value
                        if (v !== '' && Number(v) > 100) v = '100'
                        if (v !== '' && Number(v) < 0)   v = '0'
                        setDraft(d => ({ ...d, [st.id]: v }))
                      }}
                    />
                  </td>
                  <td className={`text-center font-bold text-sm ${grade.color}`}>
                    {grade.label}
                  </td>
                </tr>
              )
            })}
            {students.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-slate-400">
                ไม่มีข้อมูลนักเรียน
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <button className="btn-indigo mt-4" onClick={handleSave} disabled={saving || !hasDraft}>
        {saving ? 'กำลังบันทึก...' : `บันทึกคะแนนเทอม ${semester}`}
      </button>

      {saved && (
        <div className="toast">✓ บันทึกคะแนนเรียบร้อย</div>
      )}
    </div>
  )
}
