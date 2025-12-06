# คู่มือการอัปโหลดขึ้นเว็บไซต์ (Deployment Guide)

คู่มือนี้จะช่วยให้คุณนำ Dashboard นี้ขึ้นออนไลน์เพื่อให้คนอื่นสามารถเข้าดูผ่านอินเทอร์เน็ตได้ฟรี โดยใช้บริการของ **GitHub** และ **Vercel**

---

## ขั้นตอนที่ 1: เตรียม GitHub (ที่เก็บโค้ด)

1.  สมัครบัญชี [GitHub.com](https://github.com/) (ถ้ายังไม่มี)
2.  ไปที่หน้า [Create a new repository](https://github.com/new)
3.  ตั้งชื่อ Repository (เช่น `thailife-dashboard`)
4.  เลือก **Public** (สาธารณะ) หรือ **Private** (ส่วนตัว) ก็ได้
5.  **ไม่ต้องติ๊ก** "Add a README file" หรือ .gitignore
6.  กดปุ่ม **Create repository**

---

## ขั้นตอนที่ 2: อัปโหลดโค้ดขึ้น GitHub

เปิด **Terminal** ในเครื่องคุณ (หรือใช้ VS Code Terminal) แล้วพิมคำสั่งตามนี้ทีละบรรทัด:

```bash
# 1. เพิ่มไฟล์ทั้งหมดเข้าสู่ระบบ Git
git add .

# 2. บันทึกไฟล์ (Create commit)
git commit -m "Initial upload"

# 3. ระบุปลายทาง (เปลี่ยน URL ด้านล่างเป็นของ GitHub คุณที่ได้จากขั้นตอนที่ 1)
# ตัวอย่าง: git remote add origin https://github.com/ชื่อคุณ/thailife-dashboard.git
git remote add origin <ใส่ URL ของ GitHub ของคุณที่นี่>

# 4. อัปโหลดขึ้น GitHub
git push -u origin main
```

*(หมายเหตุ: ถ้า `git push` แจ้ง Error เรื่อง Branch ให้ลองเปลี่ยนเป็น `git push -u origin master` แทน)*

---

## ขั้นตอนที่ 3: เชื่อมต่อกับ Vercel (เว็บโฮสติ้ง)

1.  สมัครบัญชี [Vercel.com](https://vercel.com/) (แนะนำให้เลือก **Continue with GitHub**)
2.  ในหน้า Dashboard ของ Vercel กดปุ่ม **Add New...** -> **Project**
3.  คุณจะเห็นรายชื่อ Repository จาก GitHub ของคุณ ให้กดปุ่ม **Import** ที่ชื่อ `thailife-dashboard`
4.  ในหน้าตั้งค่า (Configure Project):
    *   **Framework Preset**: เลือก `Vite` (ส่วนใหญ่มันจะเลือกให้อัตโนมัติ)
    *   **Root Directory**: ปล่อยว่างไว้ (`./`)
5.  กดปุ่ม **Deploy**
6.  รอประมาณ 1 นาที... เสร็จแล้ว! คุณจะได้ลิ้งค์สำหรับเข้าเว็บ (เช่น `thailife-dashboard.vercel.app`)

---

## ขั้นตอนที่ 4: วิธีอัปเดตข้อมูล (Excel/CSV)

เมื่อคุณต้องการเปลี่ยนข้อมูลใน Dashboard:

1.  นำไฟล์ `append.xlsx`, `sent.xlsx`, หรือ `target.xlsx` ตัวใหม่ไปวางทับในโฟลเดอร์ `public/data/` ในเครื่องคุณ
2.  เปิด Terminal แล้วพิมคำสั่งเดิมเพื่ออัปเดต:

```bash
git add public/data/
git commit -m "Update data"
git push
```

3.  รอประมาณ 1-2 นาที เว็บไซต์บน Vercel จะอัปเดตข้อมูลเองอัตโนมัติ!

---

## ข้อควรระวัง
*   **ข้อมูลส่วนตัว**: ถ้าข้อมูลในไฟล์ Excel มีความลับลูกค้า (เช่น เบอร์โทร, เลขบัตร) **ห้าม** ตั้ง GitHub เป็น Public ให้เลือกเป็น **Private** ตั้งแต่ขั้นตอนที่ 1
