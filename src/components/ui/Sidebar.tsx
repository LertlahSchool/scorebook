'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Role } from '@/types'

const TEACHER_MENUS = [
  { href: '/dashboard',   icon: '📊', label: 'ภาพรวม' },
  { href: '/scores',      icon: '📝', label: 'บันทึกคะแนน' },
  { href: '/timetable',   icon: '📅', label: 'ตารางสอน' },
]

const ADMIN_MENUS = [
  { href: '/dashboard',        icon: '🏠', label: 'หน้าหลัก' },
  { href: '/admin/overview',   icon: '📊', label: 'ภาพรวมคะแนน' },
  { href: '/admin/students',   icon: '🎒', label: 'จัดการนักเรียน' },
  { href: '/admin/users',      icon: '👥', label: 'จัดการผู้ใช้' },
  { href: '/admin/timetables', icon: '🖼️', label: 'ตารางสอน' },
  { href: '/admin/export',     icon: '📥', label: 'ส่งออกข้อมูล' },
]

export default function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname()
  const menus = role === 'admin' ? ADMIN_MENUS : TEACHER_MENUS

  return (
    <aside className="w-56 bg-white border-r border-slate-100 shadow-sm flex-shrink-0 py-5">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-5 mb-2">
        {role === 'admin' ? 'จัดการระบบ' : 'เมนูหลัก'}
      </p>
      <nav className="px-3 space-y-0.5">
        {menus.map(m => {
          const isActive = pathname === m.href ||
            (m.href !== '/dashboard' && pathname.startsWith(m.href))
          return (
            <Link key={m.href} href={m.href}>
              <span className={`sidebar-item ${isActive ? 'active' : ''}`}>
                <span className="text-base w-5 text-center">{m.icon}</span>
                {m.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
