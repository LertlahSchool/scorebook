'use client'
import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase'
import { getGrade } from '@/lib/utils'

export default function AdminExportPage() {
  const supabase = createClient()
  const [subjects,  setSubjects]  = useState<any[]>([])
  const [students,  setStudents]  = useState<any[]>([])
  const [scores,    setScores]    = useState<any[]>([])
  const [users,     setUsers]     = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)

  // Filters
  const [filterSubjName, setFilterSubjName] = useState<string>('')
  const [filterClassId,  setFilterClassId]  = useState<string>('')
  const [toast, setToast] = useState('')
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2800) }

  useEffect(() => {
    const load = async () => {
      const [{ data: subj }, { data: stu }, { data: sc }, { data: usr }] = await Promise.all([
        supabase.from('subjects').select('*, class:classes(id,full_name,level)').order('name'),
        supabase.from('students').select('*, class:classes(full_name)').order('class_id,no'),
        supabase.from('scores').select('*'),
        supabase.from('users').select('id,name').eq('role','teacher'),
      ])
      setSubjects(subj || []); setStudents(stu || [])
      setScores(sc   || []); setUsers(usr  || [])
      setLoading(false)
    }
    load()
  }, [])

  // Lookup
  const scoreLookup: Record<string, number | null> = {}
  scores.forEach(s => { scoreLookup[`${s.student_id}_${s.subject_id}_${s.semester}`] = s.score })

  // Unique subject names
  const subjectNames = [...new Set(subjects.map(s => s.name))].sort()

  // Classes for selected subject
  const classesForSubject = subjects
    .filter(s => s.name === filterSubjName)
    .map(s => s.class).filter(Boolean)
    .sort((a:any, b:any) => a.full_name.localeCompare(b.full_name))
    .filter((v:any, i:number, arr:any[]) => arr.findIndex((x:any) => x.id === v.id) === i)

  // Subjects to export (apply both filters)
  const filteredSubjects = subjects.filter(s => {
    if (filterSubjName && s.name !== filterSubjName) return false
    if (filterClassId  && s.class_id !== filterClassId) return false
    return true
  })

  // Build rows
  const buildRows = (subjList: any[]) => subjList.flatMap(subj => {
    const teacher = users.find(u => u.id === subj.teacher_id)
    return students.filter(st => st.class_id === subj.class_id)
      .sort((a:any,b:any)=>(a.no??999)-(b.no??999))
      .map(st => ({
        class:   subj.class?.full_name,
        subject: subj.name,
        teacher: teacher?.name || '',
        no:      st.no ?? '',
        code:    st.student_code ?? '',
        fname:   st.first_name ?? '',
        lname:   st.last_name  ?? '',
        name:    [st.first_name, st.last_name].filter(Boolean).join(' ') || st.name,
        nickname:st.nickname ?? '',
        national:st.national_id ?? '',
        t1:      scoreLookup[`${st.id}_${subj.id}_1`] ?? null,
        t2:      scoreLookup[`${st.id}_${subj.id}_2`] ?? null,
      }))
  })

  const allRows      = buildRows(subjects)
  const filteredRows = buildRows(filteredSubjects)

  const filled   = allRows.filter(r => r.t1 !== null || r.t2 !== null).length
  const possible = allRows.length

  // ── Export filtered to Excel ────────────────────────────
  const handleExport = (subjList: any[], label: string) => {
    const rows = buildRows(subjList)
    if (rows.length === 0) { showToast('ไม่มีข้อมูลสำหรับส่งออก'); return }

    const wb = XLSX.utils.book_new()

    // Group by class
    const byClass = new Map<string, typeof rows>()
    rows.forEach(row => {
      const key = `${row.subject}_${row.class}`
      if (!byClass.has(key)) byClass.set(key, [])
      byClass.get(key)!.push(row)
    })

    byClass.forEach((sheetRows, key) => {
      const header = ['เลขที่','รหัสนักเรียน','เลขบัตรประชาชน',
        'ชื่อ','นามสกุล','ชื่อเล่น',
        'คะแนนเทอม 1','คะแนนเทอม 2','รวม','เกรด']
      const data: any[][] = [
        [`วิชา: ${sheetRows[0].subject}  ชั้น: ${sheetRows[0].class}`],
        [`ครูผู้สอน: ${sheetRows[0].teacher}`],
        [],
        header,
        ...sheetRows.map(r => {
          const total = r.t1 !== null && r.t2 !== null ? r.t1 + r.t2 : null
          const avg   = total !== null ? total / 2 : null
          const grade = avg !== null
            ? avg>=80?'A':avg>=70?'B':avg>=60?'C':avg>=50?'D':'F' : '—'
          return [r.no, r.code, r.national, r.fname, r.lname, r.nickname,
                  r.t1??'', r.t2??'', total??'', grade]
        }),
        [],
        ['','','','','เฉลี่ย','',
          sheetRows.filter(r=>r.t1!==null).length
            ? (sheetRows.filter(r=>r.t1!==null).reduce((a,r)=>a+(r.t1??0),0)/sheetRows.filter(r=>r.t1!==null).length).toFixed(2)
            : '',
          sheetRows.filter(r=>r.t2!==null).length
            ? (sheetRows.filter(r=>r.t2!==null).reduce((a,r)=>a+(r.t2??0),0)/sheetRows.filter(r=>r.t2!==null).length).toFixed(2)
            : '',
          '', ''],
      ]
      const ws = XLSX.utils.aoa_to_sheet(data)
      ws['!cols'] = [8,14,16,14,14,10,14,14,10,8].map(w=>({wch:w}))
      ws['!merges'] = [{s:{r:0,c:0},e:{r:0,c:9}},{s:{r:1,c:0},e:{r:1,c:9}}]
      const sheetName = key.replace(/[/\\?*[\]]/g,'_').slice(0,31)
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    })

    const filename = `คะแนน_${label}_${new Date().toLocaleDateString('th-TH')}.xlsx`
    XLSX.writeFile(wb, filename)
    showToast(`ดาวน์โหลด "${filename}" เรียบร้อย`)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">ส่งออกข้อมูลคะแนน</h1>
      <p className="text-sm text-slate-500 mb-6">กรองข้อมูลตามวิชาและห้อง แล้วดาวน์โหลดเป็นไฟล์ Excel</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label:'นักเรียนทั้งหมด', value: students.length, color:'#4F46E5' },
          { label:'รายการคะแนน',     value: scores.length,   color:'#059669' },
          { label:'ความครบถ้วน',     value: possible>0 ? `${Math.round(filled/possible*100)}%` : '—', color:'#F59E0B' },
        ].map((s,i) => (
          <div key={i} className="card">
            <div className="w-10 h-1 rounded-full mb-3" style={{background:s.color}}/>
            <div className="text-3xl font-bold text-slate-800">{loading?'…':s.value}</div>
            <div className="text-sm text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter + Export */}
      <div className="card mb-5">
        <div className="card-title">📥 เลือกข้อมูลที่ต้องการส่งออก</div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="field-label">รายวิชา</label>
            <select className="field-select" value={filterSubjName}
              onChange={e => { setFilterSubjName(e.target.value); setFilterClassId('') }}>
              <option value="">— ทุกวิชา —</option>
              {subjectNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">ห้องเรียน</label>
            <select className="field-select" value={filterClassId}
              disabled={!filterSubjName}
              onChange={e => setFilterClassId(e.target.value)}>
              <option value="">— ทุกห้อง —</option>
              {classesForSubject.map((c:any) => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter summary */}
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl mb-4">
          <div className="text-sm text-slate-600">
            {filterSubjName
              ? <>กรองแล้ว: <b className="text-slate-800">{filterSubjName}</b>
                {filterClassId && <> / <b className="text-slate-800">{classesForSubject.find((c:any)=>c.id===filterClassId)?.full_name}</b></>}
                {' — '}<span className="text-indigo-600 font-semibold">{filteredRows.length} นักเรียน</span></>
              : <span className="text-slate-400">แสดงข้อมูลทั้งหมด — {allRows.length} นักเรียน</span>}
          </div>
          <div className="flex gap-2">
            {filterSubjName && (
              <button className="btn-secondary btn-sm"
                onClick={() => { setFilterSubjName(''); setFilterClassId('') }}>
                ล้างตัวกรอง
              </button>
            )}
            <button className="btn-success"
              onClick={() => handleExport(
                filterSubjName ? filteredSubjects : subjects,
                filterSubjName
                  ? [filterSubjName, classesForSubject.find((c:any)=>c.id===filterClassId)?.full_name].filter(Boolean).join('_')
                  : 'ทุกวิชา'
              )}
              disabled={loading}>
              ⬇️ Download Excel
              {filterSubjName ? ` (${filteredRows.length} คน)` : ` (ทั้งหมด)`}
            </button>
          </div>
        </div>

        {/* Preview table */}
        <div className="text-sm font-semibold text-slate-600 mb-2">
          ตัวอย่างข้อมูล (แสดง {Math.min(filteredRows.length, 8)} จาก {filteredRows.length} รายการ)
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="data-table">
            <thead><tr>
              <th>ที่</th><th>ชื่อ-นามสกุล</th><th>รหัส</th>
              {!filterSubjName && <th>วิชา</th>}
              {!filterClassId  && <th>ห้อง</th>}
              <th className="text-center">เทอม 1</th>
              <th className="text-center">เทอม 2</th>
              <th className="text-center">รวม</th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-slate-400">กำลังโหลด...</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-slate-400">ไม่มีข้อมูล</td></tr>
              ) : (
                (filterSubjName ? filteredRows : allRows).slice(0, 8).map((r, i) => {
                  const total = r.t1 !== null && r.t2 !== null ? r.t1 + r.t2 : null
                  return (
                    <tr key={i}>
                      <td className="text-slate-400">{r.no}</td>
                      <td className="font-medium">{r.name}</td>
                      <td className="text-slate-400 text-xs">{r.code || '—'}</td>
                      {!filterSubjName && <td className="text-slate-600">{r.subject}</td>}
                      {!filterClassId  && <td><span className="badge badge-indigo">{r.class}</span></td>}
                      <td className="text-center">
                        {r.t1!==null ? <span className="badge badge-green">{r.t1}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="text-center">
                        {r.t2!==null ? <span className="badge badge-blue">{r.t2}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="text-center font-bold text-slate-700">
                        {total !== null ? total : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  )
}
