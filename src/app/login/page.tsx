'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail]   = useState('')
  const [password, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const router = useRouter()

  const handleLogin = async () => {
    if (!email || !password) return
    setLoading(true); setError('')
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <div className="bg-white rounded-3xl p-12 w-[400px] shadow-2xl">
        {/* Logo */}
        <div className="w-14 h-14 bg-amber-400 rounded-2xl flex items-center justify-center text-2xl mb-6">🏫</div>
        <h1 className="text-2xl font-bold text-slate-800 mb-1">ระบบบันทึกคะแนน</h1>
        <p className="text-sm text-slate-500 mb-8">โรงเรียนสองภาษาลาดพร้าว</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
            {error}
          </div>
        )}

        <label className="field-label">อีเมล</label>
        <input
          className="field-input mb-4"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="กรอกอีเมล"
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />

        <label className="field-label">รหัสผ่าน</label>
        <input
          className="field-input mb-6"
          type="password"
          value={password}
          onChange={e => setPass(e.target.value)}
          placeholder="กรอกรหัสผ่าน"
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />

        <button
          className="btn-primary btn-lg w-full"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </div>
    </div>
  )
}
