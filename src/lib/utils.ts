import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getGrade(score: number | null): { label: string; color: string } {
  if (score === null) return { label: '—', color: 'text-gray-300' }
  if (score >= 80) return { label: `${score} (A)`, color: 'text-emerald-600' }
  if (score >= 70) return { label: `${score} (B)`, color: 'text-blue-600' }
  if (score >= 60) return { label: `${score} (C)`, color: 'text-yellow-600' }
  if (score >= 50) return { label: `${score} (D)`, color: 'text-orange-500' }
  return { label: `${score} (F)`, color: 'text-red-600' }
}

export function getAvatarLetter(name: string): string {
  return name.charAt(2) || name.charAt(0) || '?'
}

export function formatThaiDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export function exportToCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}
