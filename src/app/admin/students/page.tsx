'use client'
import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase'

export default function AdminStudentsPage() {
  const supabase = createClient()
  const [classes, setClasses]     = useState<any[]>([])
  const [students, setStudents]   = useState<any[]>([])
  const [activeClass, setActive]  = useState<string | null>(null)
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [preview, setPreview]     = useState<any[] | null>(null)
  const [headers, setHeaders]     = useState<string[]>([])
  const [colMap, setColMap]       = useState({ name:'', code:'', classId:'', no:'' })
  const [importMode, setMode]     = useState<'append'|'replace'>('append')
  const [toast, setToast]         = useState('')
  const [drag, setDrag]           = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string) => {
    setToast(msg); setTimeout(() => setToast(''), 2800)
  }

  const load = async () => {
    setLoading(true)
    const [{ data: cls }, { data: sts }] = await Promise.all([
      supabase.from('classes').select('*').order('level,room'),
      supabase.from('students').select('*, class:classes(full_name)').order('class_id,no'),
    ])
    setClasses(cls || [])
    setStudents(sts || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = students.filter(st => {
    if (activeClass && st.class_id !== activeClass) return false
    if (search && !st.name.includes(search) && !(st.student_code||'').includes(search)) return false
    return true
  })

  // ── Excel parsing ─────────────────────────────────────────────
  const parseFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const wb = XLSX.read(e.target!.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (data.length < 2) { showToast('ไฟล์ว่างเปล่า'); return }
      const hdrs = data[0].map((h: any) => String(h).trim())
      const rows = data.slice(1).filter((r: any[]) => r.some((c: any) => c !== ''))
      setHeaders(hdrs)
      setPreview(rows)
      const guess = (keys: string[]) => {
        for (const k of keys) {
          const idx = hdrs.findIndex((h: string) => h.toLowerCase().includes(k))
          if (idx >= 0) return hdrs[idx]
        }
        return ''
      }
      setColMap({
        name:    guess(['ชื่อ','name','fullname','ชื่อ-สกุล','ชื่อ-นามสกุล']),
        code:    guess(['รหัส','code','student_id','เลขประจำตัว']),
        classId: guess(['ห้อง','ชั้น','class','room']),
        no:      guess(['เลขที่','ที่','no','number','ลำดับ']),
      })
    }
    reader.readAsArrayBuffer(file)
  }

  // ── Mapped preview rows ───────────────────────────────────────
  const getIdx = (h: string) => headers.indexOf(h)
  const mappedRows = (preview || []).map((r, i) => {
    const get = (h: string) => h ? String(r[getIdx(h)] || '').trim() : ''
    return {
      _idx: i, name: get(colMap.name), code: get(colMap.code),
      classId: get(colMap.classId), no: get(colMap.no),
      _valid: !!get(colMap.name) && !!get(colMap.classId),
    }
  })
  const validRows = mappedRows.filter(r => r._valid)

  // ── Confirm import ────────────────────────────────────────────
  const confirmImport = async () => {
    if (validRows.length === 0) return
    setLoading(true)

    // หา class map
    const { data: clsList } = await supabase.from('classes').select('id,full_name')
    const classMap: Record<string, string> = {}
    clsList?.forEach((c: any) => { classMap[c.full_name] = c.id })

    if (importMode === 'replace') {
      const affectedClasses = [...new Set(validRows.map(r => r.classId))]
      for (const cn of affectedClasses) {
        const cid = classMap[cn]
        if (cid) await supabase.from('students').delete().eq('class_id', cid)
      }
    }

    const toInsert = validRows.map(r => ({
      name:         r.name,
      student_code: r.code || null,
      class_id:     classMap[r.classId] || null,
      no:           r.no ? Number(r.no) : null,
    })).filter(r => r.class_id)

    if (toInsert.length > 0) {
      await supabase.from('students').upsert(toInsert, {
        onConflict: 'student_code,class_id',
        ignoreDuplicates: true,
      })
    }

    setPreview(null); setHeaders([])
    showToast(`นำเข้าสำเร็จ ${toInsert.length} รายการ`)
    await load()
  }

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      ['เลขที่','รหัสนักเรียน','ชื่อ-นามสกุล','ห้อง'],
      [1,'12345','สมชาย ตัวอย่าง','ม.1/1'],
      [2,'12346','สมหญิง ตัวอย่าง','ม.1/1'],
    ])
    XLSX.utils.book_append_sheet(wb, ws, 'นักเรียน')
    XLSX.writeFile(wb, 'template_นักเรียน.xlsx')
  }

  const deleteStudent = async (id: string) => {
    await supabase.from('students').delete().eq('id', id)
    showToast('ลบนักเรียนเรียบร้อย')
    await load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-slate-800">จัดการนักเรียน</h1>
        <button className="btn-success btn-sm" onClick={downloadTemplate}>
          📋 ดาวน์โหลด Template
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-6">นำเข้ารายชื่อนักเรียนจาก Excel หรือแก้ไขข้อมูลโดยตรง</p>

      {/* Import zone */}
      {!preview ? (
        <div className="card mb-5">
          <div className="card-title">📂 นำเข้าข้อมูลจาก Excel</div>
          <label>
            <div
              className={`import-zone ${drag ? 'dragging' : ''}`}
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if(f) parseFile(f) }}
            >
              <div className="text-5xl mb-3">📊</div>
              <div className="font-bold text-slate-700 mb-1">ลากไฟล์มาวาง หรือคลิกเพื่อเลือก</div>
              <div className="text-sm text-slate-400">รองรับ .xlsx, .xls, .csv</div>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if(f) parseFile(f) }} />
          </label>
        </div>
      ) : (
        /* Column mapping */
        <div className="card mb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="card-title mb-0">🔗 จับคู่คอลัมน์ข้อมูล</div>
            <button className="btn-secondary btn-sm" onClick={() => setPreview(null)}>✕ ยกเลิก</button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              {label:'ชื่อ-นามสกุล *', key:'name'},
              {label:'รหัสนักเรียน',   key:'code'},
              {label:'ห้อง/ชั้น *',    key:'classId'},
              {label:'เลขที่',         key:'no'},
            ].map(f => (
              <div key={f.key} className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-slate-700 w-32">{f.label}</span>
                <span className="text-slate-300">→</span>
                <select className="field-select flex-1"
                  value={(colMap as any)[f.key]}
                  onChange={e => setColMap(m => ({...m, [f.key]: e.target.value}))}>
                  <option value="">— ไม่ระบุ —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-4 flex-wrap">
            <span className="badge badge-indigo">ทั้งหมด {mappedRows.length} แถว</span>
            <span className="badge badge-green">นำเข้าได้ {validRows.length} รายการ</span>
            {mappedRows.filter(r=>!r._valid).length > 0 &&
              <span className="badge badge-red">ข้อมูลไม่ครบ {mappedRows.filter(r=>!r._valid).length} รายการ</span>}
          </div>

          <div className="flex items-center gap-4 mb-4 text-sm">
            <span className="font-semibold text-slate-700">วิธีนำเข้า:</span>
            {[{v:'append',l:'เพิ่มเติมจากที่มีอยู่'},{v:'replace',l:'แทนที่ข้อมูลเดิม'}].map(opt => (
              <label key={opt.v} className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" value={opt.v} checked={importMode===opt.v} onChange={()=>setMode(opt.v as any)} />
                {opt.l}
              </label>
            ))}
            {importMode === 'replace' && (
              <span className="text-red-600 font-semibold text-xs">⚠️ จะลบรายชื่อเดิมในชั้นที่นำเข้า!</span>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-100">
            <table className="data-table">
              <thead><tr>
                <th>#</th><th>ชื่อ-นามสกุล</th><th>รหัส</th><th>ห้อง</th><th>เลขที่</th><th>สถานะ</th>
              </tr></thead>
              <tbody>
                {mappedRows.slice(0,50).map((r,i) => (
                  <tr key={i} className={r._valid ? '' : 'bg-red-50'}>
                    <td className="text-slate-400">{i+1}</td>
                    <td className="font-medium">{r.name || <span className="text-red-400">ไม่มีข้อมูล</span>}</td>
                    <td className="text-slate-400 text-xs">{r.code||'—'}</td>
                    <td>{r.classId || <span className="text-red-400">ไม่มีข้อมูล</span>}</td>
                    <td className="text-center">{r.no||'—'}</td>
                    <td>{r._valid
                      ? <span className="badge badge-green">✓</span>
                      : <span className="badge badge-red">✗</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between mt-4 pt-4 border-t border-slate-100">
            <button className="btn-secondary" onClick={() => setPreview(null)}>ยกเลิก</button>
            <button className="btn-indigo" onClick={confirmImport} disabled={validRows.length===0||loading}>
              ✓ ยืนยันนำเข้า {validRows.length} รายการ
            </button>
          </div>
        </div>
      )}

      {/* Student list */}
      <div className="card">
        <div className="card-title">🎒 รายชื่อนักเรียน ({filtered.length} คน)</div>

        {/* Class tabs */}
        <div className="flex gap-1.5 flex-wrap mb-4">
          <button
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${!activeClass ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}
            onClick={() => setActive(null)}>
            ทั้งหมด ({students.length})
          </button>
          {classes.map(c => (
            <button key={c.id}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${activeClass===c.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}
              onClick={() => setActive(activeClass===c.id ? null : c.id)}>
              {c.full_name} ({students.filter((s:any)=>s.class_id===c.id).length})
            </button>
          ))}
        </div>

        {/* Search */}
        <input className="field-input mb-4" placeholder="🔍 ค้นหาชื่อหรือรหัสนักเรียน..."
          value={search} onChange={e => setSearch(e.target.value)} />

        {loading ? (
          <div className="text-center py-10 text-slate-400">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <div className="text-4xl mb-2">🎒</div>
            ยังไม่มีข้อมูลนักเรียน
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr>
                <th className="w-12">ที่</th>
                <th>ชื่อ-นามสกุล</th>
                <th>รหัสนักเรียน</th>
                {!activeClass && <th>ห้อง</th>}
                <th className="w-24">จัดการ</th>
              </tr></thead>
              <tbody>
                {filtered.map((st: any) => (
                  <tr key={st.id}>
                    <td className="text-slate-400 text-center">{st.no}</td>
                    <td className="font-medium">{st.name}</td>
                    <td className="text-slate-400 text-sm">{st.student_code||'—'}</td>
                    {!activeClass && <td><span className="badge badge-indigo">{st.class?.full_name}</span></td>}
                    <td>
                      <button className="btn-danger btn-sm" onClick={() => deleteStudent(st.id)}>ลบ</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  )
}
