'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

const SUBJECT_COLORS = ['#4F46E5','#059669','#DC2626','#D97706','#7C3AED','#0891B2','#BE185D','#065F46']

export default function AdminUsersPage() {
  const supabase = createClient()
  const [users, setUsers]       = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [classes, setClasses]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState<'add' | any | null>(null)
  const [delId, setDelId]       = useState<string | null>(null)
  const [toast, setToast]       = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2800) }

  const load = async () => {
    setLoading(true)
    const [{ data: u }, { data: s }, { data: c }] = await Promise.all([
      supabase.from('users').select('*').order('role,name'),
      supabase.from('subjects').select('*, class:classes(full_name)').order('created_at'),
      supabase.from('classes').select('*').order('level,room'),
    ])
    setUsers(u || []); setSubjects(s || []); setClasses(c || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (uid: string) => {
    // ลบ subjects ก่อน แล้วค่อยลบ user profile
    await supabase.from('subjects').delete().eq('teacher_id', uid)
    await supabase.from('users').delete().eq('id', uid)
    // Note: auth.users ต้องลบผ่าน Supabase Dashboard หรือ Service Role
    setDelId(null)
    showToast('ลบผู้ใช้เรียบร้อย')
    await load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-slate-800">จัดการผู้ใช้งาน</h1>
        <button className="btn-indigo" onClick={() => setModal('add')}>+ เพิ่มผู้ใช้</button>
      </div>
      <p className="text-sm text-slate-500 mb-6">เพิ่ม แก้ไข หรือลบครูและผู้ดูแลระบบ</p>

      <div className="card">
        <div className="card-title">👥 ผู้ใช้งานทั้งหมด ({users.length} คน)</div>
        {loading ? (
          <div className="text-center py-10 text-slate-400">กำลังโหลด...</div>
        ) : (
          <table className="data-table">
            <thead><tr>
              <th>ชื่อ</th><th>อีเมล</th><th>สิทธิ์</th><th>รายวิชาที่สอน</th><th>จัดการ</th>
            </tr></thead>
            <tbody>
              {users.map((u: any) => {
                const mySubj = subjects.filter((s: any) => s.teacher_id === u.id)
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600 text-sm">
                          {u.avatar || u.name.charAt(0)}
                        </div>
                        <span className="font-medium">{u.name}</span>
                      </div>
                    </td>
                    <td className="text-slate-500">{u.email}</td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'badge-blue'}`}>
                        {u.role === 'admin' ? 'Admin' : 'ครู'}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {mySubj.length > 0
                          ? mySubj.map((s: any) => (
                              <span key={s.id} className="badge text-xs"
                                style={{ background: s.color + '15', color: s.color }}>
                                {s.name} ({s.class?.full_name})
                              </span>
                            ))
                          : <span className="text-slate-300 text-sm">—</span>}
                      </div>
                    </td>
                    <td>
                      <button className="btn-secondary btn-sm mr-1.5" onClick={() => setModal(u)}>แก้ไข</button>
                      {u.role !== 'admin' && (
                        <button className="btn-danger btn-sm" onClick={() => setDelId(u.id)}>ลบ</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <UserModal
          mode={modal === 'add' ? 'add' : 'edit'}
          user={modal === 'add' ? null : modal}
          subjects={subjects}
          classes={classes}
          onClose={() => setModal(null)}
          onSaved={(msg) => { showToast(msg); load(); setModal(null) }}
        />
      )}

      {/* Delete confirm */}
      {delId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-[360px] shadow-2xl">
            <h2 className="text-lg font-bold mb-3 text-slate-800">⚠️ ยืนยันการลบ</h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              คุณต้องการลบผู้ใช้ <b>{users.find(u => u.id === delId)?.name}</b> ออกจากระบบ?
              <br/>รายวิชาที่ครูคนนี้สอนจะถูกลบด้วย
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setDelId(null)}>ยกเลิก</button>
              <button className="btn-danger" onClick={() => handleDelete(delId)}>ยืนยันการลบ</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  )
}

// ── User Add/Edit Modal ───────────────────────────────────────
function UserModal({ mode, user, subjects, classes, onClose, onSaved }: any) {
  const supabase = createClient()
  const existingSubjects = user ? subjects.filter((s: any) => s.teacher_id === user.id) : []

  const [name,     setName]     = useState(user?.name || '')
  const [email,    setEmail]    = useState(user?.email || '')
  const [password, setPass]     = useState('')
  const [role,     setRole]     = useState(user?.role || 'teacher')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [subjRows, setSubjRows] = useState<any[]>(
    existingSubjects.map((s: any) => ({ name: s.name, classId: s.class_id, color: s.color }))
  )

  const addRow    = () => setSubjRows(r => [...r, { name: '', classId: '', color: SUBJECT_COLORS[r.length % SUBJECT_COLORS.length] }])
  const removeRow = (i: number) => setSubjRows(r => r.filter((_, idx) => idx !== i))
  const setRow    = (i: number, field: string, val: string) =>
    setSubjRows(r => r.map((x, idx) => idx === i ? { ...x, [field]: val } : x))

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) { setError('กรุณากรอกชื่อและอีเมล'); return }
    setSaving(true); setError('')

    try {
      let userId = user?.id

      if (mode === 'add') {
        // สร้าง auth user
        const res = await fetch('/api/users/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: password || '12345678', name, role }),
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error || 'สร้างผู้ใช้ไม่สำเร็จ')
        userId = result.userId
      } else {
        // อัปเดต profile
        const { error: err } = await supabase.from('users').update({
          name: name.trim(),
          role,
          avatar: name.charAt(2) || name.charAt(0),
        }).eq('id', userId)
        if (err) throw err
      }

      // อัปเดต subjects
      if (role === 'teacher' && userId) {
        await supabase.from('subjects').delete().eq('teacher_id', userId)
        const validSubjects = subjRows.filter(s => s.name && s.classId)
        if (validSubjects.length > 0) {
          await supabase.from('subjects').insert(
            validSubjects.map(s => ({
              name: s.name, teacher_id: userId, class_id: s.classId, color: s.color,
            }))
          )
        }
      }

      onSaved(mode === 'add' ? `เพิ่มผู้ใช้ "${name}" เรียบร้อย` : `บันทึกข้อมูล "${name}" เรียบร้อย`)
    } catch (e: any) {
      setError(e.message || 'เกิดข้อผิดพลาด')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 w-[540px] max-h-[90vh] overflow-y-auto shadow-2xl">
        <h2 className="text-xl font-bold mb-6 text-slate-800">
          {mode === 'add' ? '➕ เพิ่มผู้ใช้ใหม่' : '✏️ แก้ไขข้อมูลผู้ใช้'}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl">{error}</div>
        )}

        <label className="field-label">ชื่อ-นามสกุล</label>
        <input className="field-input mb-4" value={name} onChange={e => setName(e.target.value)} placeholder="เช่น อ.สมชาย ดีมาก" />

        <label className="field-label">อีเมล</label>
        <input className="field-input mb-4" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="email@school.ac.th" disabled={mode === 'edit'} />

        {mode === 'add' && (
          <>
            <label className="field-label">รหัสผ่าน (ค่าเริ่มต้น: 12345678)</label>
            <input className="field-input mb-4" type="password" value={password}
              onChange={e => setPass(e.target.value)} placeholder="กรอกรหัสผ่านหรือเว้นว่าง" />
          </>
        )}

        <label className="field-label">สิทธิ์การใช้งาน</label>
        <select className="field-select mb-5" value={role} onChange={e => setRole(e.target.value)}>
          <option value="teacher">ครู</option>
          <option value="admin">Admin</option>
        </select>

        {role === 'teacher' && (
          <div>
            <div className="field-label mb-3">รายวิชาที่สอน</div>
            <div className="space-y-2">
              {subjRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl p-3">
                  <input
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-400 font-sarabun"
                    value={row.name} onChange={e => setRow(i, 'name', e.target.value)} placeholder="ชื่อวิชา"
                  />
                  <select
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none bg-white focus:border-indigo-400 font-sarabun"
                    value={row.classId} onChange={e => setRow(i, 'classId', e.target.value)}>
                    <option value="">เลือกชั้น</option>
                    {classes.map((c: any) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                  <select
                    className="w-16 px-2 py-1.5 text-sm border border-slate-200 rounded-lg outline-none font-bold"
                    style={{ background: row.color + '20', color: row.color }}
                    value={row.color} onChange={e => setRow(i, 'color', e.target.value)}>
                    {SUBJECT_COLORS.map(c => <option key={c} value={c} style={{ background: c + '20', color: c }}>■</option>)}
                  </select>
                  <button onClick={() => removeRow(i)}
                    className="w-7 h-7 rounded-lg bg-red-100 text-red-500 hover:bg-red-200 transition text-sm">✕</button>
                </div>
              ))}
            </div>
            <button onClick={addRow}
              className="mt-2 flex items-center gap-2 text-sm font-semibold text-indigo-600 border border-dashed border-indigo-300 rounded-xl px-4 py-2 hover:bg-indigo-50 transition w-full justify-center">
              + เพิ่มรายวิชา
            </button>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6 pt-5 border-t border-slate-100">
          <button className="btn-secondary" onClick={onClose}>ยกเลิก</button>
          <button className="btn-indigo" onClick={handleSave} disabled={saving || !name || !email}>
            {saving ? 'กำลังบันทึก...' : mode === 'add' ? 'เพิ่มผู้ใช้' : 'บันทึกการแก้ไข'}
          </button>
        </div>
      </div>
    </div>
  )
}
