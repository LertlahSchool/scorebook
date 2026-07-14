'use client'
import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase'
import { getGrade } from '@/lib/utils'

export default function AdminOverviewPage() {
  const supabase = createClient()

  // ── Master data ───────────────────────────────────────────
  const [subjects,  setSubjects]  = useState<any[]>([])
  const [students,  setStudents]  = useState<any[]>([])
  const [scores,    setScores]    = useState<any[]>([])
  const [users,     setUsers]     = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)

  // ── Selection state ───────────────────────────────────────
  const [selSubjectId, setSelSubjectId] = useState<string>('')
  const [selClassId,   setSelClassId]   = useState<string>('')
  const [semester,     setSemester]     = useState<1|2>(1)

  // ── Toast ─────────────────────────────────────────────────
  const [toast, setToast] = useState('')
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2800) }

  useEffect(() => {
    const load = async () => {
      const [{ data: subj }, { data: stu }, { data: sc }, { data: usr }] = await Promise.all([
        supabase.from('subjects').select('*, class:classes(id,full_name,level)').order('name'),
        supabase.from('students').select('*, class:classes(full_name)').order('class_id,no'),
        supabase.from('scores').select('*'),
        supabase.from('users').select('id,name').eq('role', 'teacher'),
      ])
      setSubjects(subj || [])
      setStudents(stu || [])
      setScores(sc   || [])
      setUsers(usr   || [])
      setLoading(false)
    }
    load()
  }, [])

  // ── Derived lists ─────────────────────────────────────────
  // unique subject names (กรอง distinct name)
  const subjectNames = [...new Map(
    subjects.map(s => [s.name, s])
  ).values()]

  // ห้องที่วิชานั้นมี (filter by selected subject name)
  const selectedSubjectName = subjects.find(s => s.id === selSubjectId)?.name || ''
  const classesForSubject = subjects
    .filter(s => s.name === selectedSubjectName)
    .map(s => s.class)
    .filter(Boolean)
    .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name))

  // subject records ที่ match ทั้ง name และ class
  const matchedSubjects = subjects.filter(s =>
    s.name === selectedSubjectName &&
    (!selClassId || s.class_id === selClassId)
  )

  // score lookup
  const scoreLookup: Record<string, number | null> = {}
  scores.forEach(s => {
    scoreLookup[`${s.student_id}_${s.subject_id}_${s.semester}`] = s.score
  })

  // build table rows
  const tableRows = matchedSubjects.flatMap(subj => {
    const classStudents = students
      .filter(st => st.class_id === subj.class_id)
      .sort((a, b) => (a.no ?? 999) - (b.no ?? 999))
    return classStudents.map(st => ({
      subj,
      st,
      t1: scoreLookup[`${st.id}_${subj.id}_1`] ?? null,
      t2: scoreLookup[`${st.id}_${subj.id}_2`] ?? null,
    }))
  })

  // stats
  const filled    = tableRows.filter(r => r.t1 !== null || r.t2 !== null).length
  const fillRatePct = tableRows.length > 0 ? Math.round(filled / tableRows.length * 100) : 0
  const avgScore = (() => {
    const vals = tableRows.map(r => semester === 1 ? r.t1 : r.t2).filter(v => v !== null) as number[]
    return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—'
  })()

  // ── Download Excel ────────────────────────────────────────
  const handleDownload = () => {
    if (tableRows.length === 0) return

    const wb = XLSX.utils.book_new()

    // group by class
    const byClass = new Map<string, typeof tableRows>()
    tableRows.forEach(row => {
      const key = row.subj.class?.full_name || 'ไม่ระบุ'
      if (!byClass.has(key)) byClass.set(key, [])
      byClass.get(key)!.push(row)
    })

    byClass.forEach((rows, className) => {
      const teacher = users.find(u => u.id === rows[0]?.subj.teacher_id)
      const sheetData: any[][] = [
        // Title rows
        [`รายงานคะแนน: ${selectedSubjectName}  ชั้น ${className}`],
        [`ครูผู้สอน: ${teacher?.name || '—'}   ภาคเรียนที่ 1–2 ปีการศึกษา 2568`],
        [],
        ['เลขที่', 'รหัสนักเรียน', 'ชื่อ', 'นามสกุล', 'ชื่อเล่น',
         'คะแนนเทอม 1 /100', 'คะแนนเทอม 2 /100', 'รวม /200', 'เกรดเฉลี่ย'],
      ]

      rows.forEach(row => {
        const total = row.t1 !== null && row.t2 !== null ? row.t1 + row.t2 : null
        const avg   = total !== null ? total / 2 : null
        const grade = avg !== null
          ? avg >= 80 ? 'A' : avg >= 70 ? 'B' : avg >= 60 ? 'C' : avg >= 50 ? 'D' : 'F'
          : '—'
        sheetData.push([
          row.st.no ?? '',
          row.st.student_code ?? '',
          row.st.first_name ?? row.st.name ?? '',
          row.st.last_name ?? '',
          row.st.nickname ?? '',
          row.t1 ?? '',
          row.t2 ?? '',
          total ?? '',
          grade,
        ])
      })

      // Summary row
      const t1Vals = rows.map(r => r.t1).filter(v => v !== null) as number[]
      const t2Vals = rows.map(r => r.t2).filter(v => v !== null) as number[]
      sheetData.push([])
      sheetData.push([
        '', '', '', '', 'เฉลี่ย',
        t1Vals.length ? (t1Vals.reduce((a,b)=>a+b,0)/t1Vals.length).toFixed(2) : '',
        t2Vals.length ? (t2Vals.reduce((a,b)=>a+b,0)/t2Vals.length).toFixed(2) : '',
        '', '',
      ])

      const ws = XLSX.utils.aoa_to_sheet(sheetData)
      ws['!cols'] = [8,14,16,16,10,18,18,12,12].map(w => ({ wch: w }))
      // Merge title row
      ws['!merges'] = [
        { s:{r:0,c:0}, e:{r:0,c:8} },
        { s:{r:1,c:0}, e:{r:1,c:8} },
      ]
      XLSX.utils.book_append_sheet(wb, ws, className.replace(/\//g,'_').slice(0,30))
    })

    const filename = [
      'คะแนน',
      selectedSubjectName,
      selClassId ? classesForSubject.find((c:any) => c.id === selClassId)?.full_name : 'ทุกห้อง',
      `${new Date().toLocaleDateString('th-TH')}`
    ].filter(Boolean).join('_') + '.xlsx'

    XLSX.writeFile(wb, filename)
    showToast(`ดาวน์โหลด "${filename}" เรียบร้อย`)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">ภาพรวมคะแนน</h1>
      <p className="text-sm text-slate-500 mb-6">เลือกรายวิชาและห้องเรียนเพื่อดูและส่งออกคะแนน</p>

      {/* ── FILTER BAR ── */}
      <div className="card mb-5">
        <div className="card-title">🔍 เลือกรายวิชาและห้อง</div>
        <div className="grid grid-cols-3 gap-4">
          {/* เลือกวิชา */}
          <div>
            <label className="field-label">รายวิชา</label>
            <select className="field-select"
              value={selSubjectId}
              onChange={e => {
                setSelSubjectId(e.target.value)
                setSelClassId('')
              }}>
              <option value="">— เลือกรายวิชา —</option>
              {subjectNames.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* เลือกห้อง */}
          <div>
            <label className="field-label">ห้องเรียน</label>
            <select className="field-select"
              value={selClassId}
              disabled={!selSubjectId}
              onChange={e => setSelClassId(e.target.value)}>
              <option value="">— ทุกห้อง —</option>
              {classesForSubject.map((c: any) => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          </div>

          {/* เทอม */}
          <div>
            <label className="field-label">ภาคเรียน (สำหรับแสดงผล)</label>
            <div className="flex gap-2 mt-1">
              {([1,2] as const).map(s => (
                <button key={s}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                    semester === s ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-400'
                  }`}
                  onClick={() => setSemester(s)}>เทอม {s}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── ยังไม่ได้เลือกวิชา ── */}
      {!selSubjectId && (
        <div className="card text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">📊</div>
          <div className="font-semibold text-slate-500 text-lg">เลือกรายวิชาเพื่อดูข้อมูล</div>
          <div className="text-sm mt-1">คุณสามารถเลือกดูเฉพาะห้อง หรือดูทุกห้องพร้อมกัน</div>
        </div>
      )}

      {/* ── มีการเลือกวิชาแล้ว ── */}
      {selSubjectId && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-5">
            {[
              { label: 'นักเรียนทั้งหมด', value: tableRows.length,    color: '#4F46E5' },
              { label: 'กรอกแล้ว',        value: filled,              color: '#059669' },
              { label: 'ความครบถ้วน',     value: `${fillRatePct}%`,  color: '#F59E0B' },
              { label: `คะแนนเฉลี่ยเทอม ${semester}`, value: avgScore, color: '#DC2626' },
            ].map((s, i) => (
              <div key={i} className="card py-4">
                <div className="w-8 h-1 rounded-full mb-2" style={{ background: s.color }}/>
                <div className="text-2xl font-bold text-slate-800">{loading ? '…' : s.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="card mb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-slate-700 text-sm">
                ความคืบหน้าการกรอกคะแนน — {selectedSubjectName}
                {selClassId && ` (${classesForSubject.find((c:any) => c.id === selClassId)?.full_name})`}
              </div>
              <span className="text-sm font-bold text-indigo-600">{fillRatePct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3">
              <div className="h-3 rounded-full transition-all duration-700"
                style={{ width: `${fillRatePct}%`,
                  background: fillRatePct === 100 ? '#059669' : '#4F46E5' }}/>
            </div>
            <div className="text-xs text-slate-400 mt-1.5">
              กรอกแล้ว {filled} จาก {tableRows.length} รายการ
            </div>
          </div>

          {/* Table */}
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="card-title mb-0">
                📋 รายละเอียดคะแนน — {selectedSubjectName}
                {selClassId && ` ชั้น ${classesForSubject.find((c:any) => c.id === selClassId)?.full_name}`}
              </div>
              <button
                className="btn-success btn-sm"
                onClick={handleDownload}
                disabled={tableRows.length === 0}>
                ⬇️ Download Excel
              </button>
            </div>

            <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
              <table className="data-table">
                <thead className="sticky top-0">
                  <tr>
                    <th className="w-10">ที่</th>
                    <th>ชื่อ-นามสกุล</th>
                    <th>ชื่อเล่น</th>
                    <th>รหัส</th>
                    {!selClassId && <th>ห้อง</th>}
                    <th className="text-center">เทอม 1 /100</th>
                    <th className="text-center">เทอม 2 /100</th>
                    <th className="text-center">รวม /200</th>
                    <th className="text-center">เกรด</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="text-center py-10 text-slate-400">กำลังโหลด...</td></tr>
                  ) : tableRows.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-10 text-slate-400">
                      ไม่มีข้อมูลนักเรียน
                    </td></tr>
                  ) : (
                    tableRows.map((row, i) => {
                      const total = row.t1 !== null && row.t2 !== null ? row.t1 + row.t2 : null
                      const avg   = total !== null ? total / 2 : null
                      const grade = getGrade(avg)
                      const curScore = semester === 1 ? row.t1 : row.t2
                      const curGrade = getGrade(curScore)
                      return (
                        <tr key={i}>
                          <td className="text-slate-400 text-center">{row.st.no}</td>
                          <td>
                            <div className="font-medium">
                              {[row.st.first_name, row.st.last_name].filter(Boolean).join(' ') || row.st.name}
                            </div>
                          </td>
                          <td className="text-slate-400 text-sm">{row.st.nickname || '—'}</td>
                          <td className="text-slate-400 text-sm font-mono">{row.st.student_code || '—'}</td>
                          {!selClassId && (
                            <td><span className="badge badge-indigo">{row.subj.class?.full_name}</span></td>
                          )}
                          <td className="text-center">
                            {row.t1 !== null
                              ? <span className="font-semibold text-slate-700">{row.t1}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="text-center">
                            {row.t2 !== null
                              ? <span className="font-semibold text-slate-700">{row.t2}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="text-center font-bold text-slate-700">
                            {total !== null ? total : <span className="text-slate-300">—</span>}
                          </td>
                          <td className={`text-center font-bold text-sm ${grade.color}`}>
                            {avg !== null ? grade.label.replace(`${avg.toFixed(1)} `, '') : '—'}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>

                {/* Summary footer */}
                {tableRows.length > 0 && !loading && (
                  <tfoot>
                    <tr className="bg-slate-50">
                      <td colSpan={selClassId ? 3 : 4} className="px-4 py-3 text-sm font-bold text-slate-600 text-right">
                        คะแนนเฉลี่ย:
                      </td>
                      <td className="text-center px-4 py-3 font-bold text-indigo-600">
                        {(() => {
                          const vals = tableRows.map(r => r.t1).filter(v => v !== null) as number[]
                          return vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : '—'
                        })()}
                      </td>
                      <td className="text-center px-4 py-3 font-bold text-indigo-600">
                        {(() => {
                          const vals = tableRows.map(r => r.t2).filter(v => v !== null) as number[]
                          return vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : '—'
                        })()}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Per-class breakdown (เมื่อดูทุกห้อง) */}
          {!selClassId && matchedSubjects.length > 1 && (
            <div className="card mt-5">
              <div className="card-title">📈 สรุปรายห้อง</div>
              <table className="data-table">
                <thead><tr>
                  <th>ห้อง</th><th>ครูผู้สอน</th><th>นักเรียน</th>
                  <th className="text-center">กรอกเทอม 1</th>
                  <th className="text-center">กรอกเทอม 2</th>
                  <th className="text-center">ความคืบหน้า</th>
                  <th>สถานะ</th>
                </tr></thead>
                <tbody>
                  {matchedSubjects.map(subj => {
                    const sts     = students.filter(st => st.class_id === subj.class_id)
                    const teacher = users.find(u => u.id === subj.teacher_id)
                    const f1 = sts.filter(st => scoreLookup[`${st.id}_${subj.id}_1`] !== undefined).length
                    const f2 = sts.filter(st => scoreLookup[`${st.id}_${subj.id}_2`] !== undefined).length
                    const pct = sts.length ? Math.round((f1 + f2) / (sts.length * 2) * 100) : 0
                    return (
                      <tr key={subj.id}>
                        <td className="font-semibold">{subj.class?.full_name}</td>
                        <td className="text-slate-500">{teacher?.name || '—'}</td>
                        <td className="text-center">{sts.length}</td>
                        <td className="text-center">
                          <span className={`badge ${f1 === sts.length ? 'badge-green' : 'badge-amber'}`}>
                            {f1}/{sts.length}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className={`badge ${f2 === sts.length ? 'badge-green' : 'badge-amber'}`}>
                            {f2}/{sts.length}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 rounded-full h-2">
                              <div className="h-2 rounded-full"
                                style={{ width:`${pct}%`, background: pct===100?'#059669':'#4F46E5' }}/>
                            </div>
                            <span className="text-xs text-slate-500 w-8">{pct}%</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${pct===100?'badge-green':pct>0?'badge-amber':'badge-blue'}`}>
                            {pct===100?'สมบูรณ์':pct>0?'กำลังดำเนินการ':'ยังไม่เริ่ม'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  )
}
