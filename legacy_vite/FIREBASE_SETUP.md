# วิธีตั้งค่า Google Firebase (Create Firebase Project)
เพื่อให้ระบบ User ของเราสามารถล็อกอินได้จากทุกเครื่อง และเพิ่ม User แบบ Real-time ได้ฟรี เราจำเป็นต้องสร้าง "ฐานข้อมูลกลาง" (Database) บน Google Cloud ครับ

ใช้เวลาทำประมาณ **3-5 นาที** และ **ฟรีตลอดชีพ** ครับ (Spark Plan)

---

## ขั้นตอนที่ 1: สร้างโปรเจกต์ (Create Project)
1.  เข้าไปที่เว็บไซต์: [https://console.firebase.google.com/](https://console.firebase.google.com/)
2.  ล็อกอินด้วย Gmail ของคุณ
3.  กดปุ่ม **"Create a project"** (หรือ "Add project")
4.  ตั้งชื่อโปรเจกต์ (เช่น `thailife-dashboard`)
5.  กด **Continue**
6.  หน้า Google Analytics: **ปิด** (Disable) ไปเลยครับ (เราไม่ได้ใช้)
7.  กด **Create project** และรอสักครู่

---

## ขั้นตอนที่ 2: เปิดใช้งานฐานข้อมูล (Create Database)
1.  เมื่อโปรเจกต์สร้างเสร็จ ให้มองหาเมนูซ้ายมือ เลือก **"Build"** -> **"Firestore Database"**
2.  กดปุ่ม **"Create database"**
3.  **Location**: เลือก `asia-southeast1` (Singapore) เพื่อให้เว็บเราเร็วที่สุด
4.  กด **Next**
5.  **Security Rules**: เลือก **"Start in test mode"** (สำคัญมาก! เพื่อให้เราเขียนข้อมูลได้ทันทีโดยไม่ต้องตั้งค่าซับซ้อนในตอนนี้)
6.  กด **Create**

---

## ขั้นตอนที่ 3: เอาค่า Config (Get API Keys)
1.  กดรูป **"ฟันเฟือง" (Settings)** ข้างๆ ปุ่ม "Project Overview" (มุมซ้ายบน)
2.  เลือก **"Project settings"**
3.  เลื่อนลงมาข้างล่างสุด จะเจอหัวข้อ "Your apps"
4.  กดปุ่มไอคอน **Web** (รูปวงกลมที่มี `</>`)
5.  **App nickname**: ตั้งชื่ออะไรก็ได้ (เช่น `web-dashboard`)
6.  ไม่ต้องติ๊ก "Also set up Firebase Hosting"
7.  กด **Register app**
8.  คุณจะเห็นโค้ดหน้าตาประมาณนี้ (นี่คือสิ่งที่เราต้องการ!):

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyD-xxxxxxxxxxxxxxxxxxxx",
  authDomain: "thailife-dashboard.firebaseapp.com",
  projectId: "thailife-dashboard",
  storageBucket: "thailife-dashboard.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:xxxxxxxxxxxx"
};
```

**สิ่งที่ต้องทำ:**
คัดลอก (Copy) โค้ดชุด `const firebaseConfig = { ... };` ส่งมาให้ผมในแชทเลยครับ เดี๋ยวผมจะเอาไปใส่ในระบบให้เอง!
