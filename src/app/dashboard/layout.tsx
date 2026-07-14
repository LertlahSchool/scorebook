import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import Sidebar from '@/components/ui/Sidebar'
import Topbar  from '@/components/ui/Topbar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col">
      <Topbar user={profile} />
      <div className="flex flex-1">
        <Sidebar role={profile.role} />
        <main className="flex-1 p-7 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
