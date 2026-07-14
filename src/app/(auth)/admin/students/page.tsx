'use client'
import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase'

// คอลัมน์ที่ต้อง import
const FIELD_DEFS = [
  { key: 'no',           label: 'เลขที่',          required: false },
  { key: 'national_id',  label: 'เลขบัตรประชาชน',  required: false },
  { key: 'student_code', label: 'รหัสนักเรียน',    required: false },
  { key: 'first_name',   label: 'ชื่อ',             required: false },
  { key: 'last_name',    label: 'นามสกุล',          required: false },
  { key: 'first_name_en',label: 'Name',             required: false },
  { key: 'last_name_en', label: 'Surname',          required: false },
  { key: 'nickname',     label: 'ชื่อเล่น',         required: false },
  { key: 'level',        label: 'ระดับชั้น',        required: false },
  { key: 'class_name',   label: 'ห้อง (เช่น ม.1/1)', required: true  },
]

// Auto-detect keywords per field
const GUESS_KEYS: Record<string, string[]> = {
  no:           ['เลขที่','ที่','no','number','ลำดับ'],
  national_id:  ['บัตรประชาชน','national','citizenid','citizen_id','idcard'],
  student_code: ['รหัสนักเรียน','รหัส','code','student_id','studentid'],
  first_name:   ['ชื่อ','firstname','first_name'],
  last_name:    ['นามสกุล','lastname','last_name','surname'],
  first_name_en:['name','firstname_en','englishname'],
  last_name_en: ['surname','lastname_en','englishsurname'],
  nickname:     ['ชื่อเล่น','nickname','nick'],
  level:        ['ระดับ','level','grade'],
  class_name:   ['ห้อง','ชั้น','class','room'],
}

export default function AdminStudentsPage() {
  const supabase = createClient()
  const [classes,  setClasses]  = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [active,   setActive]   = useState<string | null>(null)
  const [search,   setSearch]   = useState('')
  const [loading,  setLoading]  = useState(true)
  const [preview,  setPreview]  = useState<any[] | null>(null)
  const [headers,  setHeaders]  = useState<string[]>([])
  const [colMap,   setColMap]   = useState<Record<string, string>>({})
  const [mode,     setMode]     = useState<'append'|'replace'>('append')
  const [drag,     setDrag]     = useState(false)
  const [toast,    setToast]    = useState('')
  const [editSt,   setEditSt]   = useState<any | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2800) }

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
    if (active && st.class_id !== active) return false
    const q = search.toLowerCase()
    if (!q) return true
    return st.name?.toLowerCase().includes(q) ||
           (st.student_code || '').includes(q) ||
           (st.national_id  || '').includes(q) ||
           (st.first_name   || '').toLowerCase().includes(q) ||
           (st.last_name    || '').toLowerCase().includes(q) ||
           (st.nickname     || '').toLowerCase().includes(q)
  })

  // ── Template download ─────────────────────────────────────
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      ['เลขที่','เลขบัตรประชาชน','รหัสนักเรียน','ชื่อ','นามสกุล','Name','Surname','ชื่อเล่น','ระดับชั้น','ห้อง'],
      [1,'1234567890123','ST001','สมชาย','ใจดี','Somchai','Jaidee','ต้น','ม.1','ม.1/1'],
      [2,'1234567890124','ST002','สมหญิง','รักเรียน','Somying','Rakrian','นิด','ม.1','ม.1/1'],
    ])
    ws['!cols'] = [8,16,14,12,14,14,14,10,10,10].map(w => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, ws, 'นักเรียน')
    XLSX.writeFile(wb, 'template_นักเรียน.xlsx')
  }

  // ── Parse Excel ───────────────────────────────────────────
  const parseFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const wb   = XLSX.read(e.target!.result, { type: 'array' })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (data.length < 2) { showToast('ไฟล์ว่างเปล่า'); return }
      const hdrs = data[0].map((h: any) => String(h).trim())
      const rows = data.slice(1).filter((r: any[]) => r.some(c => c !== ''))
      setHeaders(hdrs)
      setPreview(rows)
      // Auto-detect
      const newMap: Record<string, string> = {}
      FIELD_DEFS.forEach(f => {
        const keys = GUESS_KEYS[f.key] || []
        const found = keys.find(k => hdrs.some(h => h.toLowerCase().includes(k)))
        newMap[f.key] = found ? hdrs.find(h => h.toLowerCase().includes(found))! || '' : ''
      })
      setColMap(newMap)
    }
    reader.readAsArrayBuffer(file)
  }

  const getIdx = (h: string) => headers.indexOf(h)
  const getCell = (row: any[], header: string) =>
    header ? String(row[getIdx(header)] ?? '').trim() : ''

  const mappedRows = (preview || []).map((r, i) => {
    const obj: Record<string, string> = {}
    FIELD_DEFS.forEach(f => { obj[f.key] = getCell(r, colMap[f.key]) })
    // full name = first + last
    obj._fullname = [obj.first_name, obj.last_name].filter(Boolean).join(' ')
    obj._valid = !!obj.class_name
    obj._row = String(i + 2)
    return obj
  })
  const validRows = mappedRows.filter(r => r._valid)

  // ── Confirm import ────────────────────────────────────────
  const confirmImport = async () => {
    setLoading(true)
    const { data: clsList } = await supabase.from('classes').select('id,full_name')
    const classMap: Record<string, string> = {}
    clsList?.forEach((c: any) => { classMap[c.full_name] = c.id })

    if (mode === 'replace') {
      const affected = [...new Set(validRows.map(r => r.class_name))]
      for (const cn of affected) {
        const cid = classMap[cn]
        if (cid) await supabase.from('students').delete().eq('class_id', cid)
      }
    }

    const toInsert = validRows.map(r => ({
      no:           r.no ? Number(r.no) : null,
      national_id:  r.national_id  || null,
      student_code: r.student_code || null,
      name:         r._fullname || r.first_name || r.last_name || r.student_code || '—',
      first_name:   r.first_name   || null,
      last_name:    r.last_name    || null,
      first_name_en:r.first_name_en || null,
      last_name_en: r.last_name_en || null,
      nickname:     r.nickname     || null,
      level:        r.level        || null,
      class_id:     classMap[r.class_name] || null,
    })).filter(r => r.class_id)

    if (toInsert.length > 0) {
      await supabase.from('students').upsert(toInsert, {
        onConflict: 'student_code,class_id', ignoreDuplicates: true,
      })
    }
    setPreview(null); setHeaders([])
    showToast(`นำเข้าสำเร็จ ${toInsert.length} รายการ`)
    await load()
  }

  const deleteStudent = async (id: string) => {
    await supabase.from('students').delete().eq('id', id)
    showToast('ลบนักเรียนเรียบร้อย')
    await load()
  }

  const saveEdit = async (st: any) => {
    const { id, ...fields } = st
    await supabase.from('students').update(fields).eq('id', id)
    setEditSt(null)
    showToast('บันทึกข้อมูลนักเรียนเรียบร้อย')
    await load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-slate-800">จัดการนักเรียน</h1>
        <button className="btn-success btn-sm" onClick={downloadTemplate}>📋 ดาวน์โหลด Template</button>
      </div>
      <p className="text-sm text-slate-500 mb-6">นำเข้ารายชื่อนักเรียนจาก Excel หรือแก้ไขข้อมูลโดยตรง</p>

      {/* IMPORT ZONE */}
      {!preview ? (
        <div className="card mb-5">
          <div className="card-title">📂 นำเข้าข้อมูลจาก Excel</div>
          <div className="mb-4 p-4 bg-indigo-50 rounded-xl text-sm text-indigo-700 leading-relaxed">
            <b>คอลัมน์ที่รองรับ:</b> เลขที่ · เลขบัตรประชาชน · รหัสนักเรียน · ชื่อ · นามสกุล · Name · Surname · ชื่อเล่น · ระดับชั้น · <b>ห้อง (จำเป็น)</b>
          </div>
          <label>
            <div className={`import-zone ${drag ? 'dragging' : ''}`}
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if(f) parseFile(f) }}>
              <div className="text-5xl mb-3">📊</div>
              <div className="font-bold text-slate-700 mb-1">ลากไฟล์มาวาง หรือคลิกเพื่อเลือก</div>
              <div className="text-sm text-slate-400">รองรับ .xlsx, .xls, .csv</div>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if(f) parseFile(f) }} />
          </label>
        </div>
      ) : (
        /* COLUMN MAPPING */
        <div className="card mb-5">
          <div className="flex items-center justify-between mb-5">
            <div className="card-title mb-0">🔗 จับคู่คอลัมน์ข้อมูล</div>
            <button className="btn-secondary btn-sm" onClick={() => setPreview(null)}>✕ ยกเลิก</button>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-5">
            {FIELD_DEFS.map(f => (
              <div key={f.key} className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-slate-700 w-36 flex-shrink-0">
                  {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                </span>
                <span className="text-slate-300">→</span>
                <select className="field-select flex-1 py-1.5 text-xs"
                  value={colMap[f.key] || ''}
                  onChange={e => setColMap(m => ({ ...m, [f.key]: e.target.value }))}>
                  <option value="">— ไม่ระบุ —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-4 flex-wrap">
            <span className="badge badge-indigo">ทั้งหมด {mappedRows.length} แถว</span>
            <span className="badge badge-green">นำเข้าได้ {validRows.length} รายการ</span>
            {mappedRows.filter(r => !r._valid).length > 0 &&
              <span className="badge badge-red">ข้อมูลไม่ครบ {mappedRows.filter(r => !r._valid).length} รายการ</span>}
          </div>

          <div className="flex items-center gap-4 mb-4 text-sm">
            <span className="font-semibold text-slate-700">วิธีนำเข้า:</span>
            {([{v:'append',l:'เพิ่มเติม'},{v:'replace',l:'แทนที่เดิม'}] as const).map(opt => (
              <label key={opt.v} className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={mode===opt.v} onChange={() => setMode(opt.v)} /> {opt.l}
              </label>
            ))}
            {mode === 'replace' && <span className="text-red-500 font-semibold text-xs">⚠️ ลบรายชื่อเดิมในชั้นที่นำเข้า!</span>}
          </div>

          {/* Preview table */}
          <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-100">
            <table className="data-table">
              <thead><tr>
                <th>เลขที่</th><th>ชื่อ</th><th>นามสกุล</th><th>รหัส</th><th>ห้อง</th><th>ระดับ</th><th>สถานะ</th>
              </tr></thead>
              <tbody>
                {mappedRows.slice(0, 50).map((r, i) => (
                  <tr key={i} className={r._valid ? '' : 'bg-red-50/60'}>
                    <td className="text-slate-400">{r.no || '—'}</td>
                    <td className="font-medium">{r.first_name || '—'}</td>
                    <td>{r.last_name || '—'}</td>
                    <td className="text-slate-400 text-xs">{r.student_code || '—'}</td>
                    <td>{r.class_name || <span className="text-red-400">ไม่มีข้อมูล</span>}</td>
                    <td>{r.level || '—'}</td>
                    <td>{r._valid
                      ? <span className="badge badge-green">✓</span>
                      : <span className="badge badge-red">✗ ไม่มีห้อง</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between mt-5 pt-4 border-t border-slate-100">
            <button className="btn-secondary" onClick={() => setPreview(null)}>ยกเลิก</button>
            <button className="btn-indigo" onClick={confirmImport} disabled={validRows.length === 0 || loading}>
              ✓ ยืนยันนำเข้า {validRows.length} รายการ
            </button>
          </div>
        </div>
      )}

      {/* STUDENT LIST */}
      <div className="card">
        <div className="card-title">🎒 รายชื่อนักเรียน ({filtered.length} คน)</div>

        {/* Class tabs */}
        <div className="flex gap-1.5 flex-wrap mb-4">
          <button className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${!active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}
            onClick={() => setActive(null)}>ทั้งหมด ({students.length})</button>
          {classes.map(c => (
            <button key={c.id}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${active === c.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}
              onClick={() => setActive(active === c.id ? null : c.id)}>
              {c.full_name} ({students.filter((s: any) => s.class_id === c.id).length})
            </button>
          ))}
        </div>

        <input className="field-input mb-4"
          placeholder="🔍 ค้นหาชื่อ นามสกุล รหัส หรือเลขบัตรประชาชน..."
          value={search} onChange={e => setSearch(e.target.value)} />

        {loading ? (
          <div className="text-center py-10 text-slate-400">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <div className="text-4xl mb-2">🎒</div>ยังไม่มีข้อมูลนักเรียน
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr>
                <th className="w-10">ที่</th>
                <th>ชื่อ</th>
                <th>นามสกุล</th>
                <th>ชื่อเล่น</th>
                <th>รหัสนักเรียน</th>
                <th>เลขบัตรประชาชน</th>
                {!active && <th>ห้อง</th>}
                <th className="w-24">จัดการ</th>
              </tr></thead>
              <tbody>
                {filtered.map((st: any) => {
                  const isEditing = editSt?.id === st.id
                  return (
                    <tr key={st.id}>
                      <td className="text-slate-400 text-center">{st.no}</td>
                      <td>
                        {isEditing
                          ? <input className="w-full px-2 py-1 text-sm border rounded-lg font-sarabun outline-none focus:border-indigo-400"
                              value={editSt.first_name || ''} onChange={e => setEditSt((s: any) => ({...s, first_name: e.target.value}))} />
                          : <span className="font-medium">{st.first_name || st.name}</span>}
                      </td>
                      <td>
                        {isEditing
                          ? <input className="w-full px-2 py-1 text-sm border rounded-lg font-sarabun outline-none focus:border-indigo-400"
                              value={editSt.last_name || ''} onChange={e => setEditSt((s: any) => ({...s, last_name: e.target.value}))} />
                          : <span className="text-slate-600">{st.last_name}</span>}
                      </td>
                      <td className="text-slate-400">{st.nickname || '—'}</td>
                      <td className="text-slate-400 text-sm">{st.student_code || '—'}</td>
                      <td className="text-slate-400 text-sm font-mono">{st.national_id || '—'}</td>
                      {!active && <td><span className="badge badge-indigo">{st.class?.full_name}</span></td>}
                      <td>
                        {isEditing ? (
                          <div className="flex gap-1">
                            <button className="btn-indigo btn-sm" onClick={() => saveEdit({...editSt, name: `${editSt.first_name || ''} ${editSt.last_name || ''}`.trim()})}>บันทึก</button>
                            <button className="btn-secondary btn-sm" onClick={() => setEditSt(null)}>ยกเลิก</button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <button className="btn-secondary btn-sm" onClick={() => setEditSt({...st})}>แก้ไข</button>
                            <button className="btn-danger btn-sm" onClick={() => deleteStudent(st.id)}>ลบ</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  )
}
