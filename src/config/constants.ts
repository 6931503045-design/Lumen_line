// ไฟล์นี้ทำหน้าที่อะไร: เก็บค่าคงที่สำหรับระบบ เช่น ขีดจำกัด AI, ชื่อแผน, ช่วงวันและประเภทการทำงาน
// ใครรับผิดชอบ: ① Bot Core / ③ AI / ② Database
// เขียนในสัปดาห์: W1
// TODO: เพิ่มชื่อตัวแปรให้ครบกับแต่ละโมดูลจริงเมื่อเริ่มพัฒนา feature
// ⚖️ กฎเหล็ก G1, G4, G7

export const APP_NAME = 'JOD tang';
export const DEFAULT_TIMEZONE = 'Asia/Bangkok';
export const DEFAULT_CURRENCY = 'THB';
export const MAX_PENDING_ACTIONS_PER_USER = 20;
export const DEFAULT_PUSH_LIMIT = 100;
export const MAX_AI_CALLS_PER_DAY = 30;
export const AI_TIMEOUT_MS = 8000;
export const SUPPORTED_TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const;
export const SUPPORTED_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'] as const;

export const SUMMARY_COMMANDS = ['สรุป', 'summary', 'ยอด', 'รายรับ', 'รายจ่าย'];
export const PLAN_COMMANDS = ['แผน', 'plan', 'ออม'];
export const CANCEL_COMMANDS = ['ยกเลิก', 'cancel', 'กลับ'];
export const HELP_COMMANDS = ['ช่วยเหลือ', 'help', 'menu'];
