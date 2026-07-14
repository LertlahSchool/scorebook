-- ============================================================
--  ScoreBook — Storage Buckets
--  วิธีใช้: รันใน Supabase SQL Editor หลังจาก 001
-- ============================================================

-- สร้าง bucket สำหรับเก็บรูปตารางสอน
INSERT INTO storage.buckets (id, name, public)
VALUES ('timetables', 'timetables', false)
ON CONFLICT DO NOTHING;

-- Policy: ครู upload ได้เฉพาะ folder ตัวเอง
CREATE POLICY "timetable_upload_admin" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'timetables'
    AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- Policy: ครูดาวน์โหลดได้เฉพาะไฟล์ตัวเอง, admin ได้ทั้งหมด
CREATE POLICY "timetable_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'timetables'
    AND (
      (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
      OR name LIKE (auth.uid()::text || '/%')
    )
  );

-- Policy: admin ลบได้
CREATE POLICY "timetable_delete_admin" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'timetables'
    AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );
