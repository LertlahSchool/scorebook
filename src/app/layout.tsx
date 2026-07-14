import type { Metadata } from 'next'
import { Sarabun } from 'next/font/google'
import './globals.css'

const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sarabun',
})

export const metadata: Metadata = {
  title: 'ScoreBook — ระบบบันทึกคะแนนนักเรียน',
  description: 'ระบบบันทึกและจัดการคะแนนนักเรียน สำหรับครูและผู้บริหาร',
}

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={`${sarabun.variable} font-sarabun antialiased bg-slate-50`}>
        {children}
      </body>
    </html>
  )
}
