-- ============================================================
--  ScoreBook — Initial Schema
--  วิธีใช้: Copy ทั้งหมด วางใน Supabase SQL Editor แล้วกด Run
-- ============================================================

-- ── 0. Extensions ────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. USERS (เก็บข้อมูลครูและ Admin) ───────────────────────
-- หมายเหตุ: Supabase มี auth.users อยู่แล้ว
-- ตารางนี้เก็บข้อมูลเพิ่มเติม (profile)
CREATE TABLE public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher', 'admin')),
  avatar      TEXT,                          -- ตัวอักษรย่อ เช่น "ส"
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. CLASSES (ห้องเรียน) ───────────────────────────────────
CREATE TABLE public.classes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name   TEXT UNIQUE NOT NULL,          -- เช่น "ม.1/1"
  level       TEXT NOT NULL,                 -- เช่น "ม.1"
  room        TEXT NOT NULL,                 -- เช่น "1"
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. STUDENTS (นักเรียน) ───────────────────────────────────
CREATE TABLE public.students (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_code  TEXT,                        -- รหัสนักเรียน
  name          TEXT NOT NULL,
  class_id      UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  no            INTEGER,                     -- เลขที่
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_code, class_id)
);

-- ── 4. SUBJECTS (รายวิชา) ────────────────────────────────────
CREATE TABLE public.subjects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,                 -- ชื่อวิชา
  teacher_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  color       TEXT DEFAULT '#4F46E5',        -- สีประจำวิชา
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (teacher_id, class_id, name)
);

-- ── 5. SCORES (คะแนน) ───────────────────────────────────────
CREATE TABLE public.scores (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id  UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  semester    INTEGER NOT NULL CHECK (semester IN (1, 2)),
  score       NUMERIC(5,2) CHECK (score >= 0 AND score <= 100),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  UUID REFERENCES public.users(id),
  UNIQUE (student_id, subject_id, semester)
);

-- ── 6. TIMETABLES (ตารางสอน รายบุคคล) ──────────────────────
CREATE TABLE public.timetables (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  image_url    TEXT NOT NULL,                -- URL จาก Supabase Storage
  file_name    TEXT,
  uploaded_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (teacher_id)                        -- ครู 1 คน มีได้ 1 ตาราง
);

-- ── 7. Updated_at trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_scores_updated_at
  BEFORE UPDATE ON public.scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 8. ROW LEVEL SECURITY (RLS) ──────────────────────────────
ALTER TABLE public.users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetables ENABLE ROW LEVEL SECURITY;

-- Helper function: เช็ค role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ── USERS policies ───────────────────────────────────────────
-- ทุกคนที่ login แล้วเห็น users ได้ (สำหรับแสดงชื่อครู)
CREATE POLICY "users_select_all" ON public.users
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- แก้ไขได้เฉพาะตัวเอง หรือ admin
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (
    id = auth.uid() OR public.get_user_role() = 'admin'
  );

-- เพิ่ม user ได้เฉพาะ admin
CREATE POLICY "users_insert_admin" ON public.users
  FOR INSERT WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "users_delete_admin" ON public.users
  FOR DELETE USING (public.get_user_role() = 'admin');

-- ── CLASSES policies ─────────────────────────────────────────
CREATE POLICY "classes_select_all" ON public.classes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "classes_manage_admin" ON public.classes
  FOR ALL USING (public.get_user_role() = 'admin');

-- ── STUDENTS policies ────────────────────────────────────────
-- ครูเห็นนักเรียนเฉพาะห้องที่ตนสอน
CREATE POLICY "students_select_teacher" ON public.students
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      public.get_user_role() = 'admin'
      OR class_id IN (
        SELECT class_id FROM public.subjects
        WHERE teacher_id = auth.uid()
      )
    )
  );

CREATE POLICY "students_manage_admin" ON public.students
  FOR ALL USING (public.get_user_role() = 'admin');

-- ── SUBJECTS policies ────────────────────────────────────────
-- ครูเห็นเฉพาะวิชาของตัวเอง, admin เห็นทั้งหมด
CREATE POLICY "subjects_select" ON public.subjects
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      public.get_user_role() = 'admin'
      OR teacher_id = auth.uid()
    )
  );

CREATE POLICY "subjects_manage_admin" ON public.subjects
  FOR ALL USING (public.get_user_role() = 'admin');

-- ── SCORES policies ──────────────────────────────────────────
-- ครูเห็น/แก้ไขคะแนนเฉพาะวิชาที่ตนสอน
CREATE POLICY "scores_select_teacher" ON public.scores
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      public.get_user_role() = 'admin'
      OR subject_id IN (
        SELECT id FROM public.subjects WHERE teacher_id = auth.uid()
      )
    )
  );

CREATE POLICY "scores_upsert_teacher" ON public.scores
  FOR INSERT WITH CHECK (
    subject_id IN (
      SELECT id FROM public.subjects WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "scores_update_teacher" ON public.scores
  FOR UPDATE USING (
    subject_id IN (
      SELECT id FROM public.subjects WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "scores_manage_admin" ON public.scores
  FOR ALL USING (public.get_user_role() = 'admin');

-- ── TIMETABLES policies ──────────────────────────────────────
-- ครูเห็นเฉพาะตารางของตัวเอง
CREATE POLICY "timetables_select_own" ON public.timetables
  FOR SELECT USING (
    teacher_id = auth.uid() OR public.get_user_role() = 'admin'
  );

CREATE POLICY "timetables_manage_admin" ON public.timetables
  FOR ALL USING (public.get_user_role() = 'admin');

-- ── 9. Seed Data (ห้องเรียนตัวอย่าง) ───────────────────────
INSERT INTO public.classes (full_name, level, room) VALUES
  ('ม.1/1', 'ม.1', '1'), ('ม.1/2', 'ม.1', '2'), ('ม.1/3', 'ม.1', '3'),
  ('ม.2/1', 'ม.2', '1'), ('ม.2/2', 'ม.2', '2'), ('ม.2/3', 'ม.2', '3'),
  ('ม.3/1', 'ม.3', '1'), ('ม.3/2', 'ม.3', '2'), ('ม.3/3', 'ม.3', '3'),
  ('ม.4/1', 'ม.4', '1'), ('ม.4/2', 'ม.4', '2'),
  ('ม.5/1', 'ม.5', '1'), ('ม.5/2', 'ม.5', '2'),
  ('ม.6/1', 'ม.6', '1'), ('ม.6/2', 'ม.6', '2')
ON CONFLICT DO NOTHING;

-- ============================================================
--  ✅ เสร็จแล้ว! ต่อไปทำตาม docs/SETUP_GUIDE.md
-- ============================================================
