import { createClient } from './supabase'
import type { Score } from '@/types'

// ── AUTH ─────────────────────────────────────────────────────

export async function getCurrentUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('users').select('*').eq('id', user.id).single()
  return data
}

// ── SUBJECTS ─────────────────────────────────────────────────

export async function getMySubjects(teacherId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('subjects')
    .select('*, class:classes(*)')
    .eq('teacher_id', teacherId)
    .order('created_at')
  return { data, error }
}

export async function getAllSubjects() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('subjects')
    .select('*, class:classes(*), teacher:users(id,name,email)')
    .order('created_at')
  return { data, error }
}

// ── STUDENTS ─────────────────────────────────────────────────

export async function getStudentsByClass(classId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('class_id', classId)
    .order('no')
  return { data, error }
}

export async function getAllStudents() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('students')
    .select('*, class:classes(*)')
    .order('class_id, no')
  return { data, error }
}

// ── SCORES ───────────────────────────────────────────────────

export async function getScoresBySubject(subjectId: string, semester: 1 | 2) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('scores')
    .select('*, student:students(*)')
    .eq('subject_id', subjectId)
    .eq('semester', semester)
  return { data, error }
}

export async function upsertScore(
  studentId: string,
  subjectId: string,
  semester: 1 | 2,
  score: number,
  updatedBy: string
) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('scores')
    .upsert({
      student_id: studentId,
      subject_id: subjectId,
      semester,
      score,
      updated_by: updatedBy,
    }, { onConflict: 'student_id,subject_id,semester' })
    .select()
    .single()
  return { data, error }
}

export async function upsertScoresBatch(
  scores: Omit<Score, 'id' | 'updated_at'>[],
) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('scores')
    .upsert(scores, { onConflict: 'student_id,subject_id,semester' })
    .select()
  return { data, error }
}

// ── CLASSES ──────────────────────────────────────────────────

export async function getAllClasses() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .order('level, room')
  return { data, error }
}

// ── USERS (Admin) ─────────────────────────────────────────────

export async function getAllUsers() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('role, name')
  return { data, error }
}

// ── TIMETABLES ────────────────────────────────────────────────

export async function getTimetableByTeacher(teacherId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('timetables')
    .select('*')
    .eq('teacher_id', teacherId)
    .single()
  return { data, error }
}

export async function getAllTimetables() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('timetables')
    .select('*, teacher:users(id,name,email,avatar)')
  return { data, error }
}
