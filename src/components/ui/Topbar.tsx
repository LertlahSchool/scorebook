'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { User } from '@/types'

export default function Topbar({ user }: { user: User }) {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-15 bg-slate-900 text-white flex items-center justify-between px-6 sticky top-0 z-50 shadow-lg" style={{height:'60px'}}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center text-base">🏫</div>
        <span className="font-bold text-base">ScoreBook</span>
        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
          {user.role === 'admin' ? 'Admin' : 'ครู'}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-300">{user.name}</span>
        <div className="w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center font-bold text-sm text-slate-900">
          {user.avatar || user.name.charAt(0)}
        </div>
        <button
          onClick={handleLogout}
          className="text-slate-400 border border-slate-700 text-xs px-3 py-1.5 rounded-lg hover:bg-slate-800 transition"
        >
          ออกจากระบบ
        </button>
      </div>
    </header>
  )
}
