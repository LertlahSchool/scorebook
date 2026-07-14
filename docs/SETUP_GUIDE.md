# 📖 คู่มือติดตั้ง ScoreBook Web App
## ตั้งแต่ต้นจนเสร็จ ใช้งานได้จริง

---

## ⏱ เวลาโดยประมาณ: 30–60 นาที

---

## ✅ สิ่งที่ต้องมีก่อนเริ่ม

- [ ] คอมพิวเตอร์ที่มี Internet
- [ ] บัญชี GitHub (ฟรี) → github.com
- [ ] บัญชี Supabase (ฟรี) → supabase.com
- [ ] บัญชี Vercel (ฟรี) → vercel.com
- [ ] Node.js 18+ ติดตั้งบนเครื่อง → nodejs.org
- [ ] VS Code (แนะนำ) → code.visualstudio.com

---

## STEP 1 — ตั้งค่า Supabase (Database)

### 1.1 สร้าง Project
1. ไปที่ **supabase.com** → Sign In → New Project
2. ตั้งชื่อ: `scorebook`
3. ตั้ง Database Password (จดไว้ให้ดี!)
4. เลือก Region: **Southeast Asia (Singapore)**
5. รอ ~2 นาที ให้ project พร้อม

### 1.2 รัน SQL Schema
1. ในหน้า Supabase → เมนูซ้าย → **SQL Editor**
2. กด **New Query**
3. Copy เนื้อหาทั้งหมดจากไฟล์ `supabase/migrations/001_initial_schema.sql`
4. วางลงใน Editor แล้วกด **Run** (Ctrl+Enter)
5. ✅ ควรเห็น "Success. No rows returned"
6. ทำซ้ำกับ `supabase/migrations/002_storage.sql`

### 1.3 สร้าง Admin User คนแรก
1. ไปที่ **Authentication** → Users → **Add User**
2. กรอก Email และ Password ของ Admin
3. ไปที่ **SQL Editor** → รันคำสั่งนี้:

```sql
-- แทนที่ 'your-user-id' ด้วย UUID จากหน้า Authentication > Users
INSERT INTO public.users (id, email, name, role, avatar)
VALUES (
  'your-user-id-here',
  'admin@school.ac.th',
  'Admin โรงเรียน',
  'admin',
  'A'
);
```

### 1.4 เปิด Email Confirmations (ปิดสำหรับ Dev)
1. **Authentication** → **Providers** → Email
2. ปิด "Confirm email" (เพื่อความสะดวกในการทดสอบ)
3. กด Save

### 1.5 Copy API Keys
1. **Settings** (ซ้ายล่าง) → **API**
2. Copy:
   - `Project URL` → จะใช้เป็น `sb_publishable_u27_nSmgKLM79JLth54A3A_6FywrZOk`
   - `anon public` key → จะใช้เป็น `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kcmxlcXlzbGlyaHhxZWdxdHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NjUwMzYsImV4cCI6MjA5ODU0MTAzNn0.UsW4SAaALjWomEJydgolXUo9clCJl7llVTwfsS4btPg`
   - `service role keys`
   `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kcmxlcXlzbGlyaHhxZWdxdHJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk2NTAzNiwiZXhwIjoyMDk4NTQxMDM2fQ.KDrza3xIqQAhKrt-hD1mB4pgSGd4aeglMuh_dmNsPfs`
---

## STEP 2 — ตั้งค่า Project บนเครื่อง

### 2.1 Download โค้ด
```bash
# วิธีที่ 1: Clone จาก GitHub (ถ้า push แล้ว)
git clone https://github.com/YOUR_USERNAME/scorebook.git
cd scorebook

# วิธีที่ 2: ถ้ามีโฟลเดอร์อยู่แล้ว
cd scorebook
```

### 2.2 ติดตั้ง Dependencies
```bash
npm install
```

### 2.3 ตั้งค่า Environment Variables
```bash
# Copy ไฟล์ตัวอย่าง
cp .env.local.example .env.local

# เปิดไฟล์ .env.local แล้วใส่ค่าจาก Supabase
```

เนื้อหาใน `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

### 2.4 ทดสอบบนเครื่อง
```bash
npm run dev
```
เปิด browser ไปที่ **http://localhost:3000**
ลอง Login ด้วย Admin account ที่สร้างไว้

---

## STEP 3 — Push ขึ้น GitHub

### 3.1 สร้าง Repository
1. ไปที่ **github.com** → New Repository
2. ชื่อ: `scorebook`
3. Private (แนะนำ)
4. ไม่ต้อง Initialize README

### 3.2 Push โค้ด
```bash
git init
git add .
git commit -m "Initial commit: ScoreBook v1.0"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/scorebook.git
git push -u origin main
```

---

## STEP 4 — Deploy บน Vercel

### 4.1 Import Project
1. ไปที่ **vercel.com** → Sign In ด้วย GitHub
2. **New Project** → Import `scorebook`
3. Framework: **Next.js** (ตรวจจับอัตโนมัติ)

### 4.2 ใส่ Environment Variables
ใน Vercel → **Environment Variables** ใส่:
```
NEXT_PUBLIC_SUPABASE_URL    = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGci...
```

### 4.3 Deploy!
กด **Deploy** → รอ ~2 นาที

✅ ได้ URL เช่น `scorebook.vercel.app`

---

## STEP 5 — ตั้งค่า Supabase Auth Redirect

1. กลับไป Supabase → **Authentication** → **URL Configuration**
2. **Site URL**: `https://scorebook.vercel.app`
3. **Redirect URLs**: เพิ่ม `https://scorebook.vercel.app/**`
4. Save

---

## STEP 6 — เพิ่มผู้ใช้งาน (ครู)

### วิธีที่ 1: ผ่าน Supabase Dashboard
1. **Authentication** → **Users** → **Add User**
2. กรอก Email + Password
3. รัน SQL เพิ่ม profile:

```sql
INSERT INTO public.users (id, email, name, role, avatar)
VALUES (
  'user-id-from-auth',
  'somsri@school.ac.th',
  'อ.สมศรี วงศ์ดี',
  'teacher',
  'ส'
);
```

### วิธีที่ 2: ผ่านหน้า Admin ในแอป (แนะนำ)
1. Login เป็น Admin
2. ไปที่ **จัดการผู้ใช้** → เพิ่มผู้ใช้

---

## 🔧 การแก้ไขโค้ดในอนาคต

```bash
# 1. แก้ไขโค้ดบนเครื่อง
# 2. ทดสอบ local
npm run dev

# 3. Push ขึ้น GitHub
git add .
git commit -m "ปรับปรุง: เพิ่มฟีเจอร์ X"
git push

# Vercel จะ Auto-Deploy ภายใน 1-2 นาที ✅
```

---

## ❓ แก้ปัญหาที่พบบ่อย

| ปัญหา | สาเหตุ | วิธีแก้ |
|---|---|---|
| Login ไม่ได้ | ยังไม่ได้ Insert profile | รัน SQL เพิ่ม users |
| หน้าขาว | ENV ไม่ถูกต้อง | ตรวจสอบ .env.local |
| RLS Error | Policy ไม่ครบ | รัน 001_schema.sql ใหม่ |
| ไม่เห็นนักเรียน | ไม่ได้ import ข้อมูล | ใช้หน้าจัดการนักเรียน |

---

## 📞 ต้องการความช่วยเหลือ

วาง error message ให้ Claude ดู แล้วบอกว่าเกิดที่ขั้นตอนไหน จะช่วยแก้ได้ทันทีครับ
