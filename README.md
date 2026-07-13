# NYK Wallet Share — Tracking Dashboard

Dashboard ติดตามงานโครงการ NYK Wallet Share แบบ Kanban (ต้องทำ / กำลังทำ / เสร็จแล้ว)
สำหรับ 12 สัปดาห์ (3 เดือน) พร้อม progress bar

## วิธีเปิดดูก่อนอัปโหลด (ทดสอบในเครื่องตัวเอง)

เปิดไฟล์ `index.html` ด้วยเบราว์เซอร์ได้เลย ไม่ต้องติดตั้งอะไรเพิ่ม

## วิธีอัปโหลดขึ้น GitHub และเปิดเป็นเว็บไซต์ (GitHub Pages)

ทำตามขั้นตอนนี้ใน Terminal ของ VS Code:

```bash
# 1. เข้าไปในโฟลเดอร์นี้
cd nyk-dashboard

# 2. ตั้งค่า git (ถ้ายังไม่เคยตั้งค่าในเครื่องนี้)
git init
git add .
git commit -m "Initial NYK tracking dashboard"

# 3. สร้าง repo ใหม่บน GitHub ก่อน (ผ่านเว็บ github.com -> New repository)
#    ตั้งชื่อ เช่น nyk-wallet-share-dashboard แล้วอย่าติ๊ก "Add README"

# 4. เชื่อม repo ในเครื่องกับ repo บน GitHub (แทน URL ด้วยของจริง)
git remote add origin https://github.com/<username>/nyk-wallet-share-dashboard.git
git branch -M main
git push -u origin main
```

จากนั้นเปิดเว็บ GitHub เข้าไปที่ repo ที่สร้าง:
1. ไปที่ **Settings** > **Pages**
2. ในหัวข้อ **Branch** เลือก `main` และโฟลเดอร์ `/ (root)`
3. กด **Save** รอ 1-2 นาที
4. จะได้ลิงก์ประมาณ `https://<username>.github.io/nyk-wallet-share-dashboard/`

ส่งลิงก์นี้ให้ทีมเปิดดูได้จากมือถือหรือคอมพิวเตอร์เครื่องไหนก็ได้

## ข้อควรรู้สำคัญ: การอัปเดตสถานะงาน

Dashboard นี้เป็นเว็บไซต์ static (ไม่มี server/ฐานข้อมูลอยู่เบื้องหลัง) ดังนั้น:

- เมื่อกดปุ่ม "ถัดไป" เพื่อเปลี่ยนสถานะงาน **ข้อมูลจะบันทึกเฉพาะในเบราว์เซอร์ของคนที่กด** (localStorage)
  คนอื่นที่เปิดลิงก์เดียวกันจะยังเห็นสถานะเดิม ไม่ sync กันอัตโนมัติ
- **วิธีทำให้ทุกคนเห็นสถานะตรงกัน:** ให้ผู้รับผิดชอบหลัก (Data lead) เป็นคนอัปเดตไฟล์ `data.json`
  (เปลี่ยนค่า `"status"` ของแต่ละ task เป็น `"todo"`, `"doing"`, หรือ `"done"`) แล้ว commit + push
  ขึ้น GitHub สัปดาห์ละครั้ง (เช่น ทุกวันศุกร์ตอนประชุมทีม) — วิธีนี้ยังได้ประโยชน์เสริมคือ
  **มีประวัติความคืบหน้าย้อนหลังผ่าน git commit history** ด้วย

  ```bash
  git add data.json
  git commit -m "Update: สัปดาห์ 3 เสร็จแล้ว"
  git push
  ```

- ถ้าต้องการให้ **ทุกคนกดอัปเดตได้แบบ real-time เหมือน Asana จริง** ต้องเพิ่มฐานข้อมูลฟรี
  เช่น Firebase Realtime Database หรือ Supabase — เป็นขั้นถัดไปถ้าจำเป็น (ใช้เวลาสร้างเพิ่มประมาณ
  ครึ่งวันถึง 1 วัน) แจ้งได้ถ้าต้องการให้ช่วยต่อ

## โครงสร้างไฟล์

```
nyk-dashboard/
├── index.html      หน้าเว็บหลัก
├── style.css       ดีไซน์และสี
├── script.js       logic การแสดงผลและย้ายสถานะ
├── data.json       รายการงานทั้ง 12 สัปดาห์ (แก้ตรงนี้เพื่ออัปเดตข้อมูล)
└── README.md       คู่มือนี้
```
