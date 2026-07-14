'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export default function AdminTimetablesPage() {
  const supabase = createClient()
  const [teachers, setTeachers]     = useState<any[]>([])
  const [timetables, setTimetables] = useState<Record<string, any>>({})
  const [preview, setPreview]       = useState<string | null>(null)
  const [previewName, setPreviewName] = useState('')
  const [uploading, setUploading]   = useState<string | null>(null)
  const [toast, setToast]           = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2800) }

  const load = async () => {
    const { data: users } = await supabase
      .from('users').select('*').eq('role', 'teacher').order('name')
    setTeachers(users || [])

    const { data: tt } = await supabase
      .from('timetables').select('*')
    const map: Record<string, any> = {}
    tt?.forEach(t => { map[t.teacher_id] = t })
    setTimetables(map)
  }

  useEffect(() => { load() }, [])

  const handleUpload = async (teacherId: string, file: File) => {
    setUploading(teacherId)
    const ext  = file.name.split('.').pop()
    const path = `${teacherId}/timetable.${ext}`

    // ลบไฟล์เก่า (ถ้ามี)
    await supabase.storage.from('timetables').remove([path])

    // อัปโหลดใหม่
    const { error: upErr } = await supabase.storage
      .from('timetables').upload(path, file, { upsert: true })

    if (upErr) { showToast('อัปโหลดไม่สำเร็จ: ' + upErr.message); setUploading(null); return }

    // บันทึก/อัปเดต record
    await supabase.from('timetables').upsert({
      teacher_id: teacherId,
      image_url:  path,
      file_name:  file.name,
    }, { onConflict: 'teacher_id' })

    showToast(`อัปโหลดตารางสอนให้ ${teachers.find(t => t.id === teacherId)?.name} เรียบร้อย`)
    setUploading(null)
    await load()
  }

  const handleDelete = async (teacherId: string) => {
    const tt = timetables[teacherId]
    if (tt?.image_url) await supabase.storage.from('timetables').remove([tt.image_url])
    await supabase.from('timetables').delete().eq('teacher_id', teacherId)
    showToast('ลบตารางสอนเรียบร้อย')
    setPreview(null)
    await load()
  }

  const handlePreview = async (teacherId: string) => {
    if (preview && previewName === teacherId) { setPreview(null); setPreviewName(''); return }
    const tt = timetables[teacherId]
    if (!tt) return
    const { data } = await supabase.storage
      .from('timetables').createSignedUrl(tt.image_url, 300)
    setPreview(data?.signedUrl || null)
    setPreviewName(teacherId)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">ตารางสอนรายบุคคล</h1>
      <p className="text-sm text-slate-500 mb-6">
        อัปโหลดตารางสอนให้ครูแต่ละคน — ครูจะเห็นเฉพาะตารางของตนเอง
      </p>

      <div className="card mb-5">
        <div className="card-title">👩‍🏫 รายชื่อครูและสถานะตารางสอน</div>
        <table className="data-table">
          <thead><tr>
            <th>ครูผู้สอน</th><th>อีเมล</th><th>สถานะ</th><th>ไฟล์</th><th>จัดการ</th>
          </tr></thead>
          <tbody>
            {teachers.map((t: any) => {
              const hasTT = !!timetables[t.id]
              const isLoading = uploading === t.id
              return (
                <tr key={t.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600 text-sm">
                        {t.avatar || t.name.charAt(0)}
                      </div>
                      <span className="font-medium">{t.name}</span>
                    </div>
                  </td>
                  <td className="text-slate-500">{t.email}</td>
                  <td>
                    <span className={`badge ${hasTT ? 'badge-green' : 'badge-amber'}`}>
                      {hasTT ? '✓ มีตารางแล้ว' : 'ยังไม่มีตาราง'}
                    </span>
                  </td>
                  <td className="text-slate-400 text-sm">
                    {timetables[t.id]?.file_name || '—'}
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {/* Upload button */}
                      <label className="cursor-pointer">
                        <span className={`btn btn-success btn-sm ${isLoading ? 'opacity-50' : ''}`}>
                          {isLoading ? 'กำลังอัปโหลด...' : hasTT ? 'อัปโหลดใหม่' : '+ อัปโหลด'}
                        </span>
                        <input type="file" accept="image/*,application/pdf" className="hidden"
                          disabled={isLoading}
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(t.id, f) }} />
                      </label>
                      {hasTT && <>
                        <button className="btn-secondary btn-sm" onClick={() => handlePreview(t.id)}>
                          {previewName === t.id ? 'ซ่อน' : 'ดูตาราง'}
                        </button>
                        <button className="btn-danger btn-sm" onClick={() => handleDelete(t.id)}>ลบ</button>
                      </>}
                    </div>
                  </td>
                </tr>
              )
            })}
            {teachers.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-slate-400">ยังไม่มีครูในระบบ</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Preview */}
      {preview && (
        <div className="card">
          <div className="card-title">
            🖼️ ตารางสอนของ {teachers.find(t => t.id === previewName)?.name}
          </div>
          <img src={preview} alt="ตารางสอน" className="w-full rounded-xl" />
        </div>
      )}

      {/* Tips */}
      <div className="card bg-amber-50 border border-amber-100">
        <div className="card-title text-amber-800">💡 วิธีใช้งาน</div>
        <ul className="text-sm text-amber-700 space-y-1.5 leading-relaxed">
          <li>• ครูแต่ละคนจะเห็นเฉพาะตารางสอนของตนเองในหน้า "ตารางสอน"</li>
          <li>• รองรับไฟล์รูปภาพ PNG, JPG, HEIC และ PDF</li>
          <li>• อัปโหลดใหม่ได้ตลอดเวลา ตารางเก่าจะถูกแทนที่ทันที</li>
          <li>• ขนาดไฟล์สูงสุด 50MB ต่อไฟล์</li>
        </ul>
      </div>

      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  )
}
