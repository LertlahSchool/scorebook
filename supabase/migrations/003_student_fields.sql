-- ============================================================
--  Migration 003 — เพิ่ม fields ใหม่ในตาราง students
--  วิธีใช้: รันใน Supabase SQL Editor
-- ============================================================

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS national_id   TEXT,          -- เลขบัตรประชาชน
  ADD COLUMN IF NOT EXISTS first_name    TEXT,          -- ชื่อ (ภาษาไทย)
  ADD COLUMN IF NOT EXISTS last_name     TEXT,          -- นามสกุล (ภาษาไทย)
  ADD COLUMN IF NOT EXISTS first_name_en TEXT,          -- Name (English)
  ADD COLUMN IF NOT EXISTS last_name_en  TEXT,          -- Surname (English)
  ADD COLUMN IF NOT EXISTS nickname      TEXT,          -- ชื่อเล่น
  ADD COLUMN IF NOT EXISTS level         TEXT;          -- ระดับชั้น เช่น ม.1

-- อัปเดต UNIQUE constraint ให้รองรับ national_id ด้วย
-- (national_id unique per school ถ้าต้องการ)
CREATE UNIQUE INDEX IF NOT EXISTS students_national_id_unique
  ON public.students (national_id)
  WHERE national_id IS NOT NULL AND national_id <> '';

-- ============================================================
COMMENT ON COLUMN public.students.national_id   IS 'เลขบัตรประชาชน 13 หลัก';
COMMENT ON COLUMN public.students.first_name    IS 'ชื่อจริงภาษาไทย';
COMMENT ON COLUMN public.students.last_name     IS 'นามสกุลภาษาไทย';
COMMENT ON COLUMN public.students.first_name_en IS 'First name in English';
COMMENT ON COLUMN public.students.last_name_en  IS 'Surname in English';
COMMENT ON COLUMN public.students.nickname      IS 'ชื่อเล่น';
COMMENT ON COLUMN public.students.level         IS 'ระดับชั้น เช่น ม.1, ม.2';
