// ไฟล์นี้ทำหน้าที่อะไร: จัดการข้อความจาก LINE — คำสั่งตายตัว → ทางด่วน L1 (regex) → L4 (AI)
// ใครรับผิดชอบ: ① Bot Core / ③ AI
// เขียนในสัปดาห์: W1 (ทางด่วน) / W2 (L4 AI)
// ⚖️ กฎเหล็ก G1, G2, G3, G4
//
// ลำดับด่านตาม SPEC §S4 และเหตุผลที่สลับกันไม่ได้:
//   1. คำสั่งตายตัว — ถูกที่สุด แม่นที่สุด ไม่งั้น "สรุป" จะถูกอ่านเป็นชื่อรายการ
//   2. ทางด่วน regex (L1) — ครอบข้อความส่วนใหญ่ ฟรี ไม่ต้องรอ network
//   3. AI (L4) — เฉพาะที่สองด่านบนอ่านไม่ออก มีค่าใช้จ่ายและมีโควตา
// ⚖️ G4: ด่าน 3 ล้มเหลวหรือปิดอยู่ ต้องยังตอบผู้ใช้ได้ด้วยคำแนะนำของด่าน 1-2
//
// 🆕 regexParser.ts เสียบ thaiNumber.ts เข้าไปแล้ว จึงคืน `amountSatang` (สตางค์) มาตรงๆ
// ไฟล์นี้ไม่ต้องเรียก money.toSatang() เองอีกต่อไป — จุดแปลงหน่วยยังอยู่ใน money.ts ที่เดียว
// (thaiNumber.ts เรียก toSatang ข้างในให้แล้ว) ตามกฎ G3
//
// ผลพลอยได้: ทางด่วน L1 รองรับ "กาแฟ ห้าสิบ" / "กาแฟ 80 บาท" / "ค่าเน็ต 1.2k" ได้แล้ว

import { getUserIdByLineUserId } from '../db/queries/users';
import { parseQuickExpenseBatch, parseQuickExpenseText, type BatchParseResult } from '../utils/regexParser';
import { getTodayIso } from '../utils/thaiDate';
import { isoDateToBangkokNoon, parseThaiDateText } from '../utils/thaiDateText';
import { createTransaction } from '../services/transaction.service';
import { formatBudgetAlert } from '../services/budget.service';
import { formatBaht, MoneyError } from '../utils/money';
import { replyFlex, replyText, replyTextWithQuickReply, type PostbackQuickReplyItem } from '../line/reply';
import { listTopCategories } from '../services/category.service';
import {
  matchCommand,
  matchSaveCommand,
  runCommand,
  runCommandCard,
  runSaveCommand,
  runUndoLatest,
  type CommandName,
} from '../services/command.service';
import { buildRecordedCardFor, type SavedEntryView } from '../line/recordedView';
import { buildPendingCard } from '../line/flex/pendingCard';
import { answerHelpTopic, matchHelpQuestion } from '../services/help.service';
import {
  buildAiUnavailableCard,
  buildAmountTooLargeCard,
  buildSaveFailedCard,
  buildUnreadableCard,
} from '../line/flex/errorCard';
import {
  FALLBACK_EXPENSE_CATEGORY,
  interpretUserMessage,
  resolveCategory,
} from '../services/ai/router';
import { MAX_AMOUNT_SATANG } from '../config/constants';
import { env } from '../config/env';

type LineTextMessageEvent = {
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
};

export async function handleText(event: LineTextMessageEvent): Promise<void> {
  const replyToken = event.replyToken;
  const lineUserId = event.source?.userId;
  const text = event.message?.text;

  if (!replyToken || !lineUserId || !text) {
    console.error('[textHandler] event ไม่มี replyToken/userId/text ครบ');
    return;
  }

  // ⚖️ G6: user_id ที่แท้จริงต้อง query จาก line_user_id ของ event เท่านั้น ห้ามเดา/รับจากที่อื่น
  const userId = await getUserIdByLineUserId(lineUserId);
  if (!userId) {
    await replyText(replyToken, 'ยังไม่พบบัญชีผู้ใช้ครับ ลองแอดเพื่อนบอทใหม่อีกครั้งนะครับ 🙏');
    return;
  }

  // ── คำสั่งตายตัวมาก่อนเสมอ (SPEC §S1) ────────────────────────────────────
  // ต้องเช็คก่อนทางด่วนบันทึกเงิน ไม่งั้น "สรุป" จะถูกมองว่าเป็นชื่อรายการที่ไม่มียอด
  try {
    if (await handleCommands(replyToken, userId, text)) return;
  } catch (err) {
    console.error('[textHandler] คำสั่งทำงานไม่สำเร็จ:', err);
    await replyText(replyToken, 'ดึงข้อมูลไม่สำเร็จ ลองใหม่อีกครั้งนะครับ 🙏');
    return;
  }

  const parsed = parseQuickExpenseText(text);

  // parsed.amountSatang = จำนวนที่ผู้ใช้พิมพ์ แปลงเป็นสตางค์แล้ว (G1: ดึงตรงๆ ไม่ประมาณ)
  if (parsed.confidence !== 'high' || parsed.amountSatang === undefined || !parsed.category) {
    // ── หลายรายการในข้อความเดียว อ่านด้วยกฎได้ ไม่ต้องรอ AI ─────────────────────
    // "ไส้กรอก 50 กับ ข้าวเย็น 46" เดิมไปถึง AI + ต้องกดยืนยัน ทั้งที่อ่านได้แน่นอน
    const batch = parseQuickExpenseBatch(text);
    if (batch) {
      await saveQuickBatch(replyToken, userId, text, batch);
      return;
    }

    // ── คำถามวิธีใช้ที่จับได้แน่ ๆ ตอบจากคู่มือเลย ────────────────────────────
    // ไม่เปลืองโควตา AI และตอบได้แม้ปิด AI อยู่ (⚖️ G4)
    // ที่จับไม่ได้ AI ยังเลือก tool explain_feature ให้ได้อีกทาง
    const helpTopic = matchHelpQuestion(text);
    if (helpTopic) {
      await replyText(replyToken, answerHelpTopic(helpTopic));
      return;
    }

    // ── ด่าน 3: L4 AI (SRS FR-13) ────────────────────────────────────────────
    // ทางด่วนอ่านไม่ออก ไม่ได้แปลว่าผู้ใช้พิมพ์ผิด — อาจเล่าเป็นประโยคยาว
    // ถามคำถาม หรือสั่งแก้/ลบ ซึ่งเป็นงานของ AI
    await handleWithAi(replyToken, userId, text);
    return;
  }

  // 🔴 คำที่ผู้ใช้พิมพ์ไม่ใช่ชื่อหมวด เป็นแค่ชื่อของที่ซื้อ
  // ถ้าส่งเข้า createTransaction ตรง ๆ findOrCreateCategory จะสร้างหมวดใหม่ทุกคำ
  // พิมพ์ "มะม่วง 500" แล้วได้หมวด "มะม่วง" เพิ่มมาหนึ่งหมวด — จด 3 วันก็มี 20 หมวด
  // แล้วหน้าสรุปรายหมวดใช้ไม่ได้อีกเลย
  //
  // ใช้กฎเดียวกับฝั่ง AI (SPEC §S11.2): จับคู่กับหมวดที่ผู้ใช้ "มีอยู่แล้ว" เท่านั้น
  // ไม่เจอ → รายจ่ายลง "อื่นๆ" ส่วนรายรับปล่อยว่างให้ระบบเลือกเอง เพราะฝั่งรายรับ
  // ไม่มีหมวด "อื่นๆ" และการโยนเงินเดือนเข้า "รายได้เสริม" คือการติดป้ายผิด
  // ── วันที่ที่ผู้ใช้บอกมาในข้อความ ("ค่าข้าวเมื่อวาน 30") ─────────────────────
  // แปลงด้วยตัวแปลงตัวเดียวกับฝั่ง AI อ่านไม่ออกหรือเกินช่วง = ไม่เดา ส่งให้ AI ถามกลับ
  // วันนี้ = ไม่ส่ง occurredAt ใช้เวลาจริงตอนบันทึก เพื่อให้ลำดับรายการในวันเดียวกันถูก
  let occurredAt: Date | undefined;
  if (parsed.dateText) {
    const occurredIso = parseThaiDateText(parsed.dateText);
    if (!occurredIso) {
      await handleWithAi(replyToken, userId, text);
      return;
    }
    if (occurredIso !== getTodayIso()) occurredAt = isoDateToBangkokNoon(occurredIso);
  }

  const entryType = parsed.type ?? 'expense';
  const matched = await resolveCategory(userId, parsed.category, entryType);
  const categoryName =
    matched?.name ?? (entryType === 'expense' ? FALLBACK_EXPENSE_CATEGORY : undefined);

  try {
    const tx = await createTransaction({
      userId,
      type: entryType,
      amountSatang: parsed.amountSatang,
      ...(categoryName ? { categoryName } : {}),
      // คำที่พิมพ์มาเก็บเป็นชื่อรายการแทน ไม่ให้หายไปเฉย ๆ
      note: parsed.category,
      ...(occurredAt ? { occurredAt } : {}),
      source: 'chat',
      // บอกว่าหมวดมาจากชั้นไหน (SPEC §S4) — ใช้ดูว่าพจนานุกรมส่วนตัวช่วยได้จริงแค่ไหน
      parsedBy: matched?.source ?? 'regex',
    });

    const card = buildRecordedCardFor(
      [
        {
          transactionId: tx.id,
          type: tx.type,
          categoryName,
          // คำที่ผู้ใช้พิมพ์คือชื่อของที่ซื้อ ไม่ใช่ชื่อหมวด แสดงเป็นชื่อรายการ
          title: parsed.category,
          amountSatang: tx.amountSatang,
          occurredAtIso: tx.occurredAt,
          budgetStatus: tx.budgetStatus,
        },
      ],
      env.appBaseUrl
    );

    // ทั้งพจนานุกรมส่วนตัวและตารางคำกลางไม่รู้จักคำนี้ (ลง "อื่นๆ") → ให้ปุ่มหมวดที่ผู้ใช้ใช้บ่อย
    // เดิมถาม AI ว่า "น่าจะหมวดอะไร" ทุกครั้ง (เปลืองโควตา ช้า และบางทีเดาผิด)
    // คนส่วนใหญ่ใช้หมวดซ้ำ ๆ ไม่กี่หมวด ปุ่มจากประวัติจึงตรงแทบทุกครั้งโดยไม่ต้องใช้ AI
    // ⚖️ G2: ไม่ย้ายหมวดให้เอง ผู้ใช้กดเลือก (set_category) แล้วระบบจะจำคำนี้ไว้ ครั้งหน้าไม่ถามอีก
    const choices = !matched && entryType === 'expense' ? await topCategoryButtons(userId, tx.id) : null;

    // S5.8: รายการนี้ทำให้ข้ามเกณฑ์งบพอดี — แนบไปกับ reply เดียวกัน
    // reply มี quota แยกจาก push และไม่จำกัดจำนวน จึงเตือนตรงนี้ได้ฟรี
    // ถ้าปล่อยไปเตือนทีหลังต้องใช้ push ซึ่งมีแค่ 280 ครั้งต่อเดือนทั้งระบบ
    const extraLines = [
      tx.budgetAlert ? formatBudgetAlert(tx.budgetAlert) : null,
      choices ? `🤔 ยังไม่รู้จัก "${parsed.category}" เลยลงหมวด ${categoryName} ไว้ก่อน — เลือกหมวดให้หน่อย ครั้งหน้าจะจำได้ครับ` : null,
    ].filter((line): line is string => Boolean(line));

    await replyFlex(replyToken, card, extraLines.length > 0 ? extraLines.join('\n\n') : undefined, choices ?? undefined);
  } catch (err) {
    console.error('[textHandler] createTransaction error:', err);
    // ยอดเกินเพดานต่อรายการเป็นเรื่องของสิ่งที่ผู้ใช้พิมพ์ ไม่ใช่ระบบพัง
    // ถ้าตอบว่า "ระบบมีปัญหา ไม่ได้เกิดจากข้อความที่พิมพ์" จะเป็นการโกหกและผู้ใช้
    // จะลองส่งซ้ำไปเรื่อย ๆ โดยไม่รู้ว่าต้องแก้ยอด
    if (err instanceof MoneyError) {
      await replyFlex(replyToken, buildAmountTooLargeCard(formatBaht(MAX_AMOUNT_SATANG)));
      return;
    }
    await replyFlex(replyToken, buildSaveFailedCard());
  }
}
/** ปุ่มหมวดที่ใช้บ่อยกี่ปุ่ม — 4 ปุ่มบวก "หมวดอื่น" ยังอยู่ในบรรทัดเดียวบนจอมือถือส่วนใหญ่ */
const TOP_CATEGORY_BUTTONS = 4;

/**
 * ปุ่ม quick reply: หมวดที่ผู้ใช้ใช้บ่อย + "หมวดอื่น" (เปิดรายชื่อทั้งหมดผ่าน edit_category)
 * ไม่มี AI ในทางนี้ · อ่านประวัติไม่สำเร็จ → null การ์ดยังออกได้ (ปุ่มเปลี่ยนหมวดบนการ์ดยังอยู่)
 */
async function topCategoryButtons(userId: string, transactionId: string): Promise<PostbackQuickReplyItem[] | null> {
  try {
    const top = await listTopCategories(userId, 'expense', TOP_CATEGORY_BUTTONS);
    if (top.length === 0) return null;
    return [
      ...top.map((category): PostbackQuickReplyItem => ({
        type: 'action',
        action: {
          type: 'postback',
          label: `${category.emoji ? `${category.emoji} ` : ''}${category.name}`.slice(0, 20),
          data: `action=set_category&id=${transactionId}&cat=${category.id}`,
          displayText: `หมวด ${category.name}`,
        },
      })),
      {
        type: 'action',
        action: {
          type: 'postback',
          label: 'หมวดอื่น',
          data: `action=edit_category&id=${transactionId}`,
          displayText: 'เลือกหมวดอื่น',
        },
      },
    ];
  } catch (err) {
    console.error('[textHandler] อ่านหมวดที่ใช้บ่อยไม่สำเร็จ (ข้ามปุ่ม):', err);
    return null;
  }
}

/**
 * จัดการคำสั่งตายตัว — คืน true ถ้าข้อความนี้เป็นคำสั่งและตอบไปแล้ว
 *
 * แยกออกมาเพื่อให้ handleText อ่านง่าย: "เป็นคำสั่งไหม ถ้าใช่จบตรงนี้
 * ถ้าไม่ใช่ค่อยลองอ่านเป็นการบันทึกเงิน"
 */
async function handleCommands(
  replyToken: string,
  userId: string,
  text: string
): Promise<boolean> {
  const trimmed = text.trim();

  // `ยกเลิก` เขียนข้อมูล จึงต้องมีปุ่มเอากลับคืนให้เสมอ (S1)
  if (trimmed === 'ยกเลิก') {
    const result = await runUndoLatest(userId);
    if (!result.ok) {
      await replyText(replyToken, result.text);
      return true;
    }
    await replyTextWithQuickReply(replyToken, result.text, [
      {
        type: 'action',
        action: {
          type: 'postback',
          label: 'เอากลับคืน',
          data: `action=restore&id=${result.transactionId}`,
          displayText: 'เอากลับคืน',
        },
      },
    ]);
    return true;
  }

  // `ออม <จำนวน>` — คำสั่งเดียวที่ไม่ต้องตรงทั้งข้อความ (SPEC §S1)
  const save = matchSaveCommand(trimmed);
  if (save) {
    const result = await runSaveCommand(userId, save.amountSatang);
    if (result.kind === 'choose') {
      // LINE จำกัด quick reply ที่ 13 ปุ่ม ส่วนแผน active มีได้สูงสุด 3 อยู่แล้ว
      await replyTextWithQuickReply(
        replyToken,
        result.text,
        result.plans.map((plan) => ({
          type: 'action' as const,
          action: {
            type: 'postback' as const,
            label: plan.title.slice(0, 20), // LINE จำกัด label ที่ 20 ตัวอักษร
            data: `action=save_to_plan&id=${plan.planId}&amt=${result.amountSatang}`,
            displayText: `ออมเข้า ${plan.title}`,
          },
        }))
      );
      return true;
    }
    await replyText(replyToken, result.text);
    return true;
  }

  const command = matchCommand(trimmed);
  if (!command) return false;

  await replyCommand(replyToken, userId, command);
  return true;
}

/**
 * บันทึกหลายรายการจากทางด่วน (L1) — กฎเดียวกับรายการเดียวทุกอย่าง: หมวดจากพจนานุกรมส่วนตัว →
 * ชื่อหมวด → ตารางคำกลาง, ไม่เจอ → รายจ่ายลง "อื่นๆ", วันที่ใช้ร่วมกันทั้งข้อความ ("เมื่อวาน...")
 *
 * ⚖️ G2 ไม่ต้องผ่าน pending: ไม่มี AI เกี่ยว ตัวเลขทุกตัวผู้ใช้พิมพ์เองและอ่านด้วยกฎตายตัว
 * เหมือน "กาแฟ 80" — ผู้ใช้ลบรายการที่ผิดได้ทันทีจากไอคอนถังขยะบนการ์ด
 */
async function saveQuickBatch(
  replyToken: string,
  userId: string,
  text: string,
  batch: BatchParseResult
): Promise<void> {
  let occurredAt: Date | undefined;
  if (batch.dateText) {
    const occurredIso = parseThaiDateText(batch.dateText);
    if (!occurredIso) {
      // อ่านคำบอกวันที่ไม่ออก = ไม่เดา ให้ AI ถามกลับเหมือนรายการเดียว
      await handleWithAi(replyToken, userId, text);
      return;
    }
    if (occurredIso !== getTodayIso()) occurredAt = isoDateToBangkokNoon(occurredIso);
  }

  const saved: SavedEntryView[] = [];
  const alerts: string[] = [];
  let failed = 0;

  // ทีละรายการ ไม่ใช่พร้อมกัน — การเตือนงบ 80%/100% ต้องเห็นยอดสะสมของรายการก่อนหน้าในชุดเดียวกัน
  for (const item of batch.items) {
    const matched = await resolveCategory(userId, item.category, item.type);
    const categoryName =
      matched?.name ?? (item.type === 'expense' ? FALLBACK_EXPENSE_CATEGORY : undefined);
    try {
      const tx = await createTransaction({
        userId,
        type: item.type,
        amountSatang: item.amountSatang,
        ...(categoryName ? { categoryName } : {}),
        note: item.category,
        ...(occurredAt ? { occurredAt } : {}),
        source: 'chat',
        parsedBy: matched?.source ?? 'regex',
      });
      saved.push({
        transactionId: tx.id,
        type: tx.type,
        categoryName,
        title: item.category,
        amountSatang: tx.amountSatang,
        occurredAtIso: tx.occurredAt,
        budgetStatus: tx.budgetStatus,
      });
      if (tx.budgetAlert) alerts.push(formatBudgetAlert(tx.budgetAlert));
    } catch (err) {
      console.error('[textHandler] บันทึกรายการในชุดไม่สำเร็จ:', err);
      failed += 1;
    }
  }

  if (saved.length === 0) {
    await replyFlex(replyToken, buildSaveFailedCard());
    return;
  }
  if (failed > 0) {
    alerts.push(`⚠️ บันทึกไม่สำเร็จ ${failed} รายการ — ลองส่งรายการนั้นใหม่อีกครั้งนะครับ`);
  }
  await replyFlex(
    replyToken,
    buildRecordedCardFor(saved, env.appBaseUrl),
    alerts.length > 0 ? alerts.join('\n\n') : undefined
  );
}

/**
 * ตอบคำสั่งตายตัว — ใช้ทั้งตอนพิมพ์คำสั่งตรง ๆ และตอน AI ตีความประโยคแล้วได้คำสั่งเดียวกัน
 * (เดิมทาง AI ได้ข้อความล้วน แต่พิมพ์ "งบ" ได้การ์ด — คำถามเดียวกันได้หน้าตาคนละแบบ)
 *
 * คำสั่งที่มีการ์ด (สรุป/แผน/งบ) ตอบเป็น Flex — ที่เหลือยังเป็นข้อความล้วน
 * ถ้าการ์ดคืน null แปลว่ายังไม่มีข้อมูลพอ (เช่นยังไม่มีแผน) ให้ถอยไปใช้ข้อความเดิม
 * ซึ่งเขียนกรณี "ยังไม่มี..." ไว้ครบแล้ว
 */
async function replyCommand(replyToken: string, userId: string, command: CommandName): Promise<void> {
  const card = await runCommandCard(userId, command);
  if (card) {
    await replyFlex(replyToken, card);
    return;
  }
  await replyText(replyToken, await runCommand(userId, command));
}

/**
 * ด่านสุดท้าย — ให้ AI ตีความข้อความที่ regex อ่านไม่ออก (SRS FR-13, SPEC §S4 L4)
 *
 * ⚖️ G2: คำขอที่เขียนข้อมูลจะไม่ถูกบันทึกที่นี่ มันมาเป็น kind='pending'
 * พร้อมปุ่มให้ผู้ใช้กดยืนยัน การกดปุ่มคือการยืนยันของมนุษย์ (ดู postbackHandler)
 *
 * ⚖️ G4: kind='unavailable' คือเส้นทางที่ AI ปิด โควตาหมด หรือล่ม
 * ตอบด้วยคำแนะนำทางด่วนเสมอ ผู้ใช้ยังจดเงินได้ไม่ว่า AI จะเป็นอย่างไร
 */
async function handleWithAi(replyToken: string, userId: string, text: string): Promise<void> {
  const reply = await interpretUserMessage({ userId, text });

  if (reply.kind === 'text') {
    await replyText(replyToken, reply.text);
    return;
  }

  if (reply.kind === 'command') {
    await replyCommand(replyToken, userId, reply.command);
    return;
  }

  if (reply.kind === 'pending') {
    // ⚖️ G2: ปุ่มในการ์ดคือจุดที่ "คน" ยืนยัน ก่อนหน้านี้ยังไม่มีอะไรถูกเขียนลงฐาน
    await replyFlex(
      replyToken,
      buildPendingCard({
        pendingId: reply.pendingId,
        summary: reply.text,
        assetBaseUrl: env.appBaseUrl,
      })
    );
    return;
  }

  // ⚖️ G4: router รวมทุกเหตุผลที่ AI ใช้ไม่ได้เป็น kind เดียว แต่ผู้ใช้ต้องการคำตอบคนละแบบ
  // ปิดไว้ถาวร = ระบบนี้อ่านประโยคยาวไม่ได้ บอกรูปแบบที่ใช้ได้ไปเลย
  // เปิดอยู่แต่ล้ม = เป็นเรื่องชั่วคราว บอกว่าลองใหม่ได้ ไม่ใช่ให้เปลี่ยนวิธีพิมพ์ถาวร
  await replyFlex(replyToken, env.aiEnabled ? buildAiUnavailableCard() : buildUnreadableCard());
}
