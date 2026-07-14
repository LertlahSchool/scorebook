'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase'
import { getGrade } from '@/lib/utils'
import type { Student, Score } from '@/types'

export default function ScoreEntryPage() {
  const { subjectId } = useParams<{ subjectId: string }>()
  const router  = useRouter()
  const supabase = createClient()
  const uploadRef = useRef<HTMLInputElement>(null)

  const [subject,  setSubject]  = useState<any>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [scores,   setScores]   = useState<Record<string, number | null>>({})
  const [draft,    setDraft]    = useState<Record<string, string>>({})
  const [semester, setSemester] = useState<1 | 2>(1)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState('')
  const [userId,   setUserId]   = useState('')
  // import state
  const [importPreview, setImportPreview] = useState<any[] | null>(null)
  const [importing, setImporting] = useState(false)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2800) }

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)

    const { data: subj } = await supabase
      .from('subjects').select('*, class:classes(*)').eq('id', subjectId).single()
    setSubject(subj)
    if (!subj) return

    const { data: sts } = await supabase
      .from('students').select('*').eq('class_id', subj.class_id).order('no')
    setStudents(sts || [])

    const { data: sc } = await supabase
      .from('scores').select('*').eq('subject_id', subjectId).eq('semester', semester)
    const map: Record<string, number | null> = {}
    sc?.forEach((s: Score) => { map[s.student_id] = s.score })
    setScores(map)
    setDraft({})
  }, [subjectId, semester])

  useEffect(() => { loadData() }, [loadData])

  // ── Download template ─────────────────────────────────────
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new()
    const header = ['เลขที่', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', `คะแนนเทอม${semester}`]
    const rows = students.map(st => [
      st.no ?? '',
      (st as any).student_code ?? '',
      st.name,
      scores[st.id] ?? '',
    ])
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    // column widths
    ws['!cols'] = [{ wch: 8 }, { wch: 14 }, { wch: 30 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, ws, `เทอม${semester}`)
    XLSX.writeFile(wb, `คะแนน_${subject?.name}_${subject?.class?.full_name}_เทอม${semester}.xlsx`)
    showToast('ดาวน์โหลดแบบฟอร์มเรียบร้อย')
  }

  // ── Parse uploaded score Excel ────────────────────────────
  const handleUploadFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const wb   = XLSX.read(e.target!.result, { type: 'array' })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (data.length < 2) { showToast('ไฟล์ว่างเปล่า'); return }
      const hdrs = data[0].map((h: any) => String(h).trim())
      const rows = data.slice(1).filter((r: any[]) => r.some(c => c !== ''))

      // หา column index
      const codeIdx  = hdrs.findIndex(h => h.includes('รหัส') || h.toLowerCase().includes('code'))
      const nameIdx  = hdrs.findIndex(h => h.includes('ชื่อ') || h.toLowerCase().includes('name'))
      const scoreIdx = hdrs.findIndex(h => h.includes('คะแนน') || h.toLowerCase().includes('score'))

      if (scoreIdx < 0) { showToast('ไม่พบคอลัมน์คะแนนในไฟล์'); return }

      // Match กับ students โดยใช้ student_code หรือชื่อ
      const studentByCode: Record<string, Student> = {}
      const studentByName: Record<string, Student> = {}
      students.forEach(st => {
        if ((st as any).student_code) studentByCode[(st as any).student_code] = st
        studentByName[st.name] = st
      })

      const parsed = rows.map((r, i) => {
        const code  = codeIdx >= 0 ? String(r[codeIdx]).trim() : ''
        const name  = nameIdx >= 0 ? String(r[nameIdx]).trim() : ''
        const score = r[scoreIdx] !== '' ? Number(r[scoreIdx]) : null
        const student = studentByCode[code] || studentByName[name] || null
        return {
          _row: i + 2,
          code, name,
          score,
          student,
          _valid: !!student && score !== null && !isNaN(score as number) && (score as number) >= 0 && (score as number) <= 100,
        }
      })
      setImportPreview(parsed)
    }
    reader.readAsArrayBuffer(file)
  }

  // ── Confirm score import ──────────────────────────────────
  const confirmImport = async () => {
    if (!importPreview) return
    setImporting(true)
    const valid = importPreview.filter(r => r._valid)
    const upsertRows = valid.map(r => ({
      student_id: r.student!.id,
      subject_id: subjectId,
      semester,
      score: r.score,
      updated_by: userId,
    }))
    await supabase.from('scores').upsert(upsertRows, {
      onConflict: 'student_id,subject_id,semester',
    })
    setImporting(false)
    setImportPreview(null)
    showToast(`อัปเดตคะแนนสำเร็จ ${valid.length} รายการ`)
    await loadData()
  }

  // ── Save draft ────────────────────────────────────────────
  const handleSave = async () => {
    if (Object.keys(draft).length === 0) return
    setSaving(true)
    await supabase.from('scores').upsert(
      Object.entries(draft).filter(([, v]) => v !== '').map(([studentId, v]) => ({
        student_id: studentId, subject_id: subjectId,
        semester, score: Number(v), updated_by: userId,
      })),
      { onConflict: 'student_id,subject_id,semester' }
    )
    setSaving(false)
    showToast('บันทึกคะแนนเรียบร้อย')
    await loadData()
  }

  const hasDraft = Object.keys(draft).length > 0

  if (!subject) return (
    <div className="flex items-center justify-center h-40 text-slate-400">กำลังโหลด...</div>
  )

  return (
    <div>
      <button onClick={() => router.back()} className="btn-secondary btn-sm mb-5">← กลับ</button>

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{subject.name} — ชั้น {subject.class?.full_name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">บันทึกคะแนนรายเทอม (เต็ม 100 คะแนน)</p>
        </div>
        {/* Action buttons */}
        <div className="flex gap-2 flex-shrink-0">
          <button className="btn-success btn-sm" onClick={downloadTemplate} disabled={students.length === 0}>
            📥 ดาวน์โหลดแบบฟอร์ม
          </button>
          <label className="cursor-pointer">
            <span className="btn btn-secondary btn-sm">📤 Upload คะแนน</span>
            <input ref={uploadRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadFile(f); e.target.value = '' }} />
          </label>
        </div>
      </div>

      {/* Semester tabs */}
      <div className="flex gap-2 mb-5">
        {([1, 2] as const).map(s => (
          <button key={s}
            className={`px-6 py-2 rounded-xl text-sm font-semibold transition ${
              semester === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'
            }`}
            onClick={() => { setSemester(s); setDraft({}) }}>
            เทอม {s}
          </button>
        ))}
      </div>

      {/* Import preview modal */}
      {importPreview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-7 w-[600px] max-h-[85vh] flex flex-col shadow-2xl">
            <h2 className="text-lg font-bold mb-1 text-slate-800">📤 ตรวจสอบข้อมูลก่อน Import</h2>
            <p className="text-sm text-slate-500 mb-4">
              พบ {importPreview.filter(r => r._valid).length} รายการที่นำเข้าได้
              {importPreview.filter(r => !r._valid).length > 0 &&
                ` / ข้อมูลไม่ครบ ${importPreview.filter(r => !r._valid).length} รายการ`}
            </p>

            <div className="flex gap-2 mb-3 flex-wrap">
              <span className="badge badge-green">✓ นำเข้าได้ {importPreview.filter(r => r._valid).length}</span>
              {importPreview.filter(r => !r._valid).length > 0 &&
                <span className="badge badge-red">✗ ข้ามไป {importPreview.filter(r => !r._valid).length}</span>}
            </div>

            <div className="flex-1 overflow-y-auto rounded-xl border border-slate-100">
              <table className="data-table">
                <thead><tr>
                  <th>รหัส</th><th>ชื่อนักเรียน</th><th className="text-center">คะแนน</th><th>สถานะ</th>
                </tr></thead>
                <tbody>
                  {importPreview.map((r, i) => (
                    <tr key={i} className={r._valid ? '' : 'bg-red-50/60'}>
                      <td className="text-slate-400 text-sm">{r.code || '—'}</td>
                      <td className="font-medium">
                        {r.student ? r.student.name : <span className="text-red-400">{r.name || 'ไม่พบในระบบ'}</span>}
                      </td>
                      <td className="text-center font-bold">
                        {r.score !== null ? r.score : <span className="text-slate-300">—</span>}
                      </td>
                      <td>
                        {r._valid
                          ? <span className="badge badge-green">✓ ผ่าน</span>
                          : <span className="badge badge-red">✗ {!r.student ? 'ไม่พบนักเรียน' : 'คะแนนไม่ถูกต้อง'}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between mt-5 pt-4 border-t border-slate-100">
              <button className="btn-secondary" onClick={() => setImportPreview(null)}>ยกเลิก</button>
              <button className="btn-indigo" onClick={confirmImport}
                disabled={importing || importPreview.filter(r => r._valid).length === 0}>
                {importing ? 'กำลัง Import...' : `✓ ยืนยัน Import ${importPreview.filter(r => r._valid).length} รายการ`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved bar */}
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
              const draftVal   = draft[st.id]
              const savedVal   = scores[st.id] ?? null
              const displayVal = draftVal !== undefined ? draftVal : (savedVal !== null ? String(savedVal) : '')
              const numVal     = displayVal === '' ? null : Number(displayVal)
              const grade      = getGrade(numVal)
              return (
                <tr key={st.id}>
                  <td className="text-slate-400 text-center">{st.no}</td>
                  <td className="font-medium">{st.name}</td>
                  <td className="text-slate-400 text-sm">{(st as any).student_code || '—'}</td>
                  <td>
                    <input className="score-input" type="number" min={0} max={100}
                      value={displayVal} placeholder="—"
                      onChange={e => {
                        let v = e.target.value
                        if (v !== '' && Number(v) > 100) v = '100'
                        if (v !== '' && Number(v) < 0)   v = '0'
                        setDraft(d => ({ ...d, [st.id]: v }))
                      }} />
                  </td>
                  <td className={`text-center font-bold text-sm ${grade.color}`}>{grade.label}</td>
                </tr>
              )
            })}
            {students.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-slate-400">ไม่มีข้อมูลนักเรียน</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 mt-4">
        <button className="btn-indigo" onClick={handleSave} disabled={saving || !hasDraft}>
          {saving ? 'กำลังบันทึก...' : `บันทึกคะแนนเทอม ${semester}`}
        </button>
        <button className="btn-success" onClick={downloadTemplate} disabled={students.length === 0}>
          📥 ดาวน์โหลดแบบฟอร์ม Excel
        </button>
      </div>

      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  )
}
