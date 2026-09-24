// ไฟล์นี้ทำหน้าที่อะไร: test สร้าง/แก้/ลบหมวดหมู่ (เบื้องหลังหน้า "หมวดหมู่")
// ใครรับผิดชอบ: ③ Core API
// เขียนในสัปดาห์: W6
// ⚖️ กฎเหล็ก G6
//
// mock ชั้น db/queries ทิ้ง เพราะสิ่งที่ต้องพิสูจน์คือ "ตรวจค่าที่ผู้ใช้ส่งมาถูกไหม"
// และ "ปฏิเสธการลบหมวดที่ยังมีรายการผูกอยู่จริงไหม" ไม่ใช่ "Supabase คืนค่าได้ไหม"

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/queries/categories', () => ({
  insertCategory: vi.fn(),
  updateCategoryForUser: vi.fn(),
  deleteCategoryForUser: vi.fn(),
  findCategoryOwnedByUser: vi.fn(),
  countTransactionsUsingCategory: vi.fn(),
}));

import {
  countTransactionsUsingCategory,
  deleteCategoryForUser,
  findCategoryOwnedByUser,
  insertCategory,
  updateCategoryForUser,
} from '../src/db/queries/categories';
import {
  CategoryError,
  createCategory,
  removeCategory,
  updateCategory,
} from '../src/services/category.service';

const USER = 'user-1';
const CAT = 'cat-food';

const row = {
  id: CAT,
  name: 'อาหาร',
  type: 'expense' as const,
  emoji: '🍜',
  is_essential: true,
  is_default: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createCategory', () => {
  it('สร้างหมวดใหม่แล้วคืนรูปแบบที่หน้าเว็บใช้ (camelCase)', async () => {
    vi.mocked(insertCategory).mockResolvedValue(row);

    const created = await createCategory(USER, { name: 'อาหาร', type: 'expense', emoji: '🍜', isEssential: true });

    expect(created).toEqual({
      id: CAT,
      name: 'อาหาร',
      type: 'expense',
      emoji: '🍜',
      isEssential: true,
      isDefault: false,
    });
    // ⚖️ G6 ต้องส่ง userId ที่ได้จาก session ลงไปทุกครั้ง
    expect(insertCategory).toHaveBeenCalledWith({
      userId: USER,
      name: 'อาหาร',
      type: 'expense',
      emoji: '🍜',
      isEssential: true,
    });
  });

  it('ตัดช่องว่างหัวท้ายของชื่อ — ไม่งั้น "อาหาร" กับ "อาหาร " จะเป็นสองหมวดที่ผู้ใช้แยกไม่ออก', async () => {
    vi.mocked(insertCategory).mockResolvedValue(row);

    await createCategory(USER, { name: '  อาหาร  ', type: 'expense' });

    expect(insertCategory).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'อาหาร' })
    );
  });

  it('ไม่ส่ง isEssential มา = false ไม่ใช่ undefined', async () => {
    vi.mocked(insertCategory).mockResolvedValue(row);

    await createCategory(USER, { name: 'อาหาร', type: 'expense' });

    expect(insertCategory).toHaveBeenCalledWith(
      expect.objectContaining({ isEssential: false, emoji: null })
    );
  });

  it('ชื่อว่างเปล่า/ช่องว่างล้วน ต้องปฏิเสธ ไม่ใช่สร้างหมวดไม่มีชื่อ', async () => {
    await expect(createCategory(USER, { name: '   ', type: 'expense' })).rejects.toThrow(CategoryError);
    expect(insertCategory).not.toHaveBeenCalled();
  });

  it('ชื่อยาวเกิน 50 ตัวอักษร ต้องปฏิเสธ', async () => {
    await expect(
      createCategory(USER, { name: 'ก'.repeat(51), type: 'expense' })
    ).rejects.toThrow(/ยาวเกิน 50/);
  });

  it('type ที่ไม่ใช่ income/expense ต้องปฏิเสธ', async () => {
    await expect(createCategory(USER, { name: 'อาหาร', type: 'transfer' })).rejects.toThrow(/income หรือ expense/);
  });

  it('ชื่อซ้ำ ตอบ 409 ไม่ใช่ 400 — คำขอถูกต้อง แค่ชนของที่มีอยู่', async () => {
    vi.mocked(insertCategory).mockResolvedValue(null);

    await expect(createCategory(USER, { name: 'อาหาร', type: 'expense' })).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe('updateCategory', () => {
  it('ส่งแต่ฟิลด์ที่แก้จริงลงไป ไม่ใช่ทั้งก้อน', async () => {
    vi.mocked(updateCategoryForUser).mockResolvedValue({ ...row, name: 'อาหารเช้า' });

    await updateCategory(USER, CAT, { name: 'อาหารเช้า' });

    expect(updateCategoryForUser).toHaveBeenCalledWith(USER, CAT, { name: 'อาหารเช้า' });
  });

  it('เปลี่ยน type ไม่ได้ — รายการเก่าทุกรายการจะเปลี่ยนความหมายย้อนหลัง', async () => {
    await expect(updateCategory(USER, CAT, { type: 'income' })).rejects.toThrow(/เปลี่ยนประเภท/);
    expect(updateCategoryForUser).not.toHaveBeenCalled();
  });

  it('ไม่ส่งฟิลด์ไหนมาเลย ต้องปฏิเสธ ไม่ใช่ยิง UPDATE เปล่า', async () => {
    await expect(updateCategory(USER, CAT, {})).rejects.toThrow(/ไม่มีฟิลด์ไหนให้แก้/);
    expect(updateCategoryForUser).not.toHaveBeenCalled();
  });

  it('emoji: null = ล้างอีโมจิ (ต่างจากไม่ส่งมาเลย)', async () => {
    vi.mocked(updateCategoryForUser).mockResolvedValue({ ...row, emoji: null });

    await updateCategory(USER, CAT, { emoji: null });

    expect(updateCategoryForUser).toHaveBeenCalledWith(USER, CAT, { emoji: null });
  });

  it('หมวดไม่ใช่ของผู้ใช้คนนี้ ตอบ 404 — ⚖️ G6 ไม่บอกว่ามีอยู่จริงแต่เป็นของคนอื่น', async () => {
    vi.mocked(updateCategoryForUser).mockResolvedValue(null);

    await expect(updateCategory(USER, CAT, { name: 'x' })).rejects.toMatchObject({ status: 404 });
  });

  it('เปลี่ยนชื่อไปชนหมวดอื่น ตอบ 409', async () => {
    vi.mocked(updateCategoryForUser).mockResolvedValue('duplicate');

    await expect(updateCategory(USER, CAT, { name: 'เดินทาง' })).rejects.toMatchObject({ status: 409 });
  });
});

describe('removeCategory', () => {
  it('ลบได้เมื่อไม่มีรายการผูกอยู่', async () => {
    vi.mocked(findCategoryOwnedByUser).mockResolvedValue(row);
    vi.mocked(countTransactionsUsingCategory).mockResolvedValue(0);
    vi.mocked(deleteCategoryForUser).mockResolvedValue(true);

    await expect(removeCategory(USER, CAT)).resolves.toBeUndefined();
    expect(deleteCategoryForUser).toHaveBeenCalledWith(USER, CAT);
  });

  it('ยังมีรายการเงินอยู่ในหมวด = ปฏิเสธพร้อมบอกจำนวน และต้องไม่ยิง DELETE เลย', async () => {
    vi.mocked(findCategoryOwnedByUser).mockResolvedValue(row);
    vi.mocked(countTransactionsUsingCategory).mockResolvedValue(12);

    await expect(removeCategory(USER, CAT)).rejects.toThrow(/ยังมี 12 รายการ/);
    // สำคัญ: ถ้ายิง DELETE ไป DB จะตอบ FK violation ซึ่งผู้ใช้อ่านไม่รู้เรื่อง
    expect(deleteCategoryForUser).not.toHaveBeenCalled();
  });

  it('หมวดไม่ใช่ของผู้ใช้คนนี้ ตอบ 404 และไม่แตะอะไรต่อ — ⚖️ G6', async () => {
    vi.mocked(findCategoryOwnedByUser).mockResolvedValue(null);

    await expect(removeCategory(USER, CAT)).rejects.toMatchObject({ status: 404 });
    expect(countTransactionsUsingCategory).not.toHaveBeenCalled();
    expect(deleteCategoryForUser).not.toHaveBeenCalled();
  });

  it('FK violation จากตารางอื่น (รายการประจำ/งบ) ต้องกลายเป็น 409 ไม่ใช่ 500', async () => {
    vi.mocked(findCategoryOwnedByUser).mockResolvedValue(row);
    vi.mocked(countTransactionsUsingCategory).mockResolvedValue(0);
    vi.mocked(deleteCategoryForUser).mockRejectedValue({ code: '23503' });

    await expect(removeCategory(USER, CAT)).rejects.toMatchObject({
      status: 409,
      name: 'CategoryError',
    });
  });

  it('error อื่นที่ไม่รู้จัก ต้องโยนต่อ ไม่กลืนแล้วบอกว่าลบสำเร็จ', async () => {
    vi.mocked(findCategoryOwnedByUser).mockResolvedValue(row);
    vi.mocked(countTransactionsUsingCategory).mockResolvedValue(0);
    vi.mocked(deleteCategoryForUser).mockRejectedValue(new Error('เน็ตหลุด'));

    await expect(removeCategory(USER, CAT)).rejects.toThrow('เน็ตหลุด');
  });
});
