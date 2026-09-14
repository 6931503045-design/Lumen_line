// ไฟล์นี้ทำหน้าที่อะไร: เปิด CORS ให้เฉพาะโดเมนของหน้า LIFF ที่ตั้งค่าไว้เท่านั้น
// ใครรับผิดชอบ: ① Bot Core / ④ Frontend
// เขียนในสัปดาห์: W3
// ⚖️ กฎเหล็ก G6
//
// ทำไมต้องมี: หน้า LIFF ถูก host แยก (เช่น GitHub Pages) คนละโดเมนกับ backend (เช่น Render)
// เบราว์เซอร์จึงบล็อก fetch ข้ามโดเมนถ้าไม่มี header ชุดนี้
//
// จงใจไม่ใช้ package `cors` และไม่ใช้ `*`:
// - ตัว logic สั้นมากจนไม่คุ้มเพิ่ม dependency
// - `Access-Control-Allow-Origin: *` ใช้คู่กับ Authorization header ไม่ได้อยู่แล้ว
//   และเปิดกว้างเกินความจำเป็น — ระบุโดเมนที่อนุญาตไปเลยตรงไปตรงมากว่า
//
// หมายเหตุ: CORS ไม่ใช่ระบบยืนยันตัวตน มันแค่บอกเบราว์เซอร์ว่าโดเมนไหนเรียกได้
// ตัวที่กันจริงคือ liffAuth ที่ตรวจ ID token — อย่าสับสนสองอย่างนี้

import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';

export function liffCors(req: Request, res: Response, next: NextFunction): void {
  const origin = req.header('origin');

  if (origin && env.liffOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    // บอก cache/proxy ว่าคำตอบต่างกันตาม Origin ไม่งั้นอาจตอบ header ของโดเมนอื่นให้ผิดคน
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
  }

  // preflight จบตรงนี้ ไม่ต้องวิ่งต่อไปหา route
  if (req.method === 'OPTIONS') {
    res.sendStatus(origin && env.liffOrigins.includes(origin) ? 204 : 403);
    return;
  }

  next();
}
