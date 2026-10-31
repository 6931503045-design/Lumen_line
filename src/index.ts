// ไฟล์นี้ทำหน้าที่อะไร: เปิดเซิร์ฟเวอร์จาก app ที่ประกอบไว้ใน app.ts
// ใครรับผิดชอบ: ① Bot Core

import { app } from './app';
import { env } from './config/env';

const port = env.port;
app.listen(port, () => {
  console.log(`JOD tang backend running on port ${port}`);
});
