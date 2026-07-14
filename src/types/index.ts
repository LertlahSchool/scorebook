// ── Database Types ────────────────────────────────────────────

export type Role = 'teacher' | 'admin'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  avatar?: string
  created_at: string
  updated_at: string
}

export interface Class {
  id: string
  full_name: string   // "ม.1/1"
  level: string       // "ม.1"
  room: string        // "1"
  created_at: string
}

export interface Student {
  id: string
  student_code?: string
  name: string
  class_id: string
  no?: number
  created_at: string
  updated_at: string
  // joined
  class?: Class
}

export interface Subject {
  id: string
  name: string
  teacher_id: string
  class_id: string
  color: string
  created_at: string
  // joined
  teacher?: User
  class?: Class
}

export interface Score {
  id: string
  student_id: string
  subject_id: string
  semester: 1 | 2
  score: number | null
  updated_at: string
  updated_by?: string
}

export interface Timetable {
  id: string
  teacher_id: string
  image_url: string
  file_name?: string
  uploaded_at: string
}

// ── API Response Types ────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

// ── UI Types ──────────────────────────────────────────────────

export interface ScoreWithStudent extends Score {
  student: Student
}

export interface SubjectWithDetails extends Subject {
  teacher: User
  class: Class
  student_count?: number
  score_count?: number
}

export type ImportMode = 'append' | 'replace'

export interface StudentImportRow {
  name: string
  student_code: string
  class_name: string
  no: string
  _valid: boolean
  _error?: string
}
