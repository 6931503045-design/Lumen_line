// JOD tang — ตัวควบคุมสไลด์
// ไม่มี library ภายนอก: เปิดไฟล์ index.html ตรง ๆ ได้ (file://) ไม่ต้องมีเซิร์ฟเวอร์ ไม่ต้องมีเน็ต
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const isEn = () => document.documentElement.lang === 'en';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stage = $('#stage');
  const slides = $$('.slide');
  const SPEAKERS = window.DECK_SPEAKERS || [];
  const NOTES = window.DECK_NOTES || [];
  let current = -1;

  // ─────────────────────── ย่อ/ขยายเวทีให้พอดีจอ ───────────────────────
  function fit() {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    document.documentElement.style.setProperty('--s', s.toFixed(4));
  }
  window.addEventListener('resize', fit);
  fit();

  // ─────────────────────── แถบความคืบหน้า แยกตามผู้พูด ───────────────────────
  const progress = $('#progress');
  const segs = SPEAKERS.map((sp) => {
    const count = slides.filter((s) => Number(s.dataset.sec) === sp.sec).length;
    const seg = document.createElement('div');
    seg.className = 'seg';
    seg.style.flex = String(count);
    seg.title = `${sp.sec} · ${sp.name} — ${sp.topic}`;
    seg.innerHTML = '<i></i>';
    progress.appendChild(seg);
    return { sp, count, el: seg.firstChild };
  });

  function updateChrome() {
    const slide = slides[current];
    const sec = Number(slide.dataset.sec);
    const sp = SPEAKERS.find((x) => x.sec === sec);

    const theme = slide.dataset.theme || (slide.classList.contains('light') ? 'light' : 'dark');
    document.documentElement.dataset.theme = theme;

    $$('#sections span').forEach((el) => el.classList.toggle('on', Number(el.dataset.sec) === sec));
    $('#speaker').textContent = sp ? `${sp.sec} · ${sp.name} — ${isEn() ? sp.topicEn : sp.topic}` : '';
    updateLiveBtn();
    $('#counter').textContent = `${String(current + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;

    segs.forEach(({ sp: s, count, el }) => {
      const inSec = slides.map((x, i) => [x, i]).filter(([x]) => Number(x.dataset.sec) === s.sec);
      const done = inSec.filter(([, i]) => i <= current).length;
      el.style.width = `${(done / count) * 100}%`;
    });
  }

  // ─────────────────────── เปลี่ยนสไลด์ ───────────────────────
  function go(index, { fromHash = false } = {}) {
    const next = Math.max(0, Math.min(slides.length - 1, index));
    if (next === current) return;
    const prev = current;
    current = next;

    slides.forEach((s, i) => {
      s.classList.toggle('active', i === current);
      s.classList.toggle('past', i < current);
    });

    if (prev >= 0) leaveSlide(slides[prev]);
    enterSlide(slides[current]);
    updateChrome();
    renderNotes();
    if (prev === 0 && current > 0) startTimerIfIdle();

    if (!fromHash) history.replaceState(null, '', `#${current + 1}`);
  }
  const nextSlide = () => go(current + 1);
  const prevSlide = () => go(current - 1);

  function enterSlide(slide) {
    $$('[data-count]', slide).forEach(countUp);
    $$('[data-chat]', slide).forEach((body) => playChat(body.dataset.chat));
    $('.tower', slide)?.classList.add('go');
    if (slide.classList.contains('s-thread')) startPacket(slide);
  }

  function leaveSlide(slide) {
    $$('[data-chat]', slide).forEach((body) => stopChat(body.dataset.chat));
    $('.tower', slide)?.classList.remove('go');
    $$('.fan-item.focus', slide).forEach((el) => el.classList.remove('focus'));
    $('.fan', slide)?.classList.remove('has-focus');
    if (slide.classList.contains('s-thread')) stopPacket();
  }

  // ─────────────────────── ตัวเลขวิ่ง ───────────────────────
  function countUp(el) {
    const target = Number(el.dataset.count);
    if (reduceMotion || !Number.isFinite(target)) {
      el.textContent = target.toLocaleString('en-US');
      return;
    }
    const start = performance.now();
    const dur = 1500;
    const delay = 450;
    el.textContent = '0';
    const tick = (now) => {
      const t = Math.min(1, Math.max(0, (now - start - delay) / dur));
      const eased = 1 - Math.pow(1 - t, 4);
      el.textContent = Math.round(target * eased).toLocaleString('en-US');
      if (t < 1 && slides[current].contains(el)) requestAnimationFrame(tick);
      else el.textContent = target.toLocaleString('en-US');
    };
    requestAnimationFrame(tick);
  }

  // ─────────────────────── แชทจำลอง ───────────────────────
  // การ์ดทุกใบลอกโครงจากการ์ด Flex จริงของบอท (src/line/flex/) — หัวข้อ ป้าย แถว ปุ่ม ข้อความ ตรงกันทุกตัว
  // ถ้าแก้การ์ดในบอท ให้แก้ที่นี่ด้วย ไม่งั้นภาพในสไลด์จะไม่ตรงกับจอมือถือตอนเดโมสด
  const MASCOT = '<img src="assets/mascot.png" alt="">';
  const NOW_LABEL = '16 พ.ย. 2569 12:30';

  /** โครงการ์ด: หัว (dark / warn / danger) + ตัวการ์ด + ปุ่มท้าย — ตรงกับ theme.ts */
  function fxCard({ title, subtitle, tone = '', mascot = true, body, buttons = [] }) {
    const foot = buttons.length
      ? `<div class="fx-foot">${buttons.map(([label, primary]) => `<span class="fx-btn${primary ? ' primary' : ''}">${label}</span>`).join('')}</div>`
      : '';
    return {
      fx: true,
      html: `<div class="fx-head ${tone}"><div><b>${title}</b>${subtitle ? `<small>${subtitle}</small>` : ''}</div>${mascot && !tone ? MASCOT : ''}</div>
        <div class="fx-body">${body}</div>${foot}`,
    };
  }

  /** การ์ด "บันทึกแล้ว" (recordedCard.ts) — budget = { pct, spent, limit } หรือ null ถ้าหมวดนี้ไม่ได้ตั้งงบ */
  const recorded = (item, amount, cat, budget) =>
    fxCard({
      title: 'บันทึกแล้ว',
      subtitle: 'อย่าลืมตรวจรายการที่บันทึกไว้นะ',
      body: `<span class="fx-tag">รายจ่าย · ${cat}</span>
        <div class="fx-time">${NOW_LABEL}</div>
        <div class="fx-item"><span>${item}</span><b>฿${amount}</b><img src="assets/icon-pencil.png" alt=""><img src="assets/icon-trash.png" alt=""></div>
        ${budget ? `<div class="fx-line"></div>
        <div class="fx-row"><span>งบ${cat}เดือนนี้</span><b>${budget.pct}%</b></div>
        <div class="fx-bar"><i style="--w:${budget.pct}%"></i></div>
        <div class="fx-sub">${budget.spent} / ${budget.limit}</div>
        <div class="fx-note end">รอบงบ: รายเดือน (เริ่มวันที่ 1)</div>` : ''}`,
      buttons: [['เปลี่ยนหมวด']],
    });

  /** การ์ด "วันนี้ใช้ได้อีก" (allowanceCard.ts) แบบที่ไม่ได้ตั้งเพดานรายวัน */
  const remaining = fxCard({
    title: 'วันนี้ใช้ได้อีก',
    body: `<div class="fx-big">฿245.00</div>
      <div class="fx-line"></div>
      <div class="fx-title">คิดมาจาก</div>
      <div class="fx-row val"><span>เงินเหลือทั้งเดือน</span><b>฿4,165.00</b></div>
      <div class="fx-row val"><span>หารวันที่เหลือ</span><b>17 วัน</b></div>
      <div class="fx-note">ข้อมูลเชิงวิเคราะห์ ไม่ใช่คำแนะนำทางการเงิน</div>`,
  });

  /** quick reply หมวดที่ใช้บ่อย (textHandler.ts topCategoryButtons) */
  const quickReply = (labels) => ({ qr: labels });

  // แต่ละแชทแบ่งเป็นช่วง (segment) — ช่วงเดียวกับขั้นที่ผู้พูดพาเดโม
  const SCRIPTS = {
    cover: [[
      [900, { me: 'กาแฟ 80' }],
      [1500, { typing: true }],
      [2300, recorded('กาแฟ', 80, 'อาหาร', { pct: 62, spent: '฿1,240', limit: '฿2,000' })],
      [3800, { me: 'เหลือ' }],
      [4300, { typing: true }],
      [5000, remaining],
    ]],
    demo: [
      [
        [0, { step: 0 }],
        [400, { me: 'กาแฟ 80' }],
        [1000, { typing: true }],
        [1800, recorded('กาแฟ', 80, 'อาหาร', { pct: 62, spent: '฿1,240', limit: '฿2,000' })],
      ],
      [
        [0, { step: 1 }],
        [400, { me: 'ร้านป้าแดง 50' }],
        [1000, { typing: true }],
        // บอทจริง: การ์ดบันทึกแล้ว (ลงหมวดอื่นๆ) + ข้อความถาม + ปุ่ม quick reply หมวดที่ใช้บ่อย
        [1800, recorded('ร้านป้าแดง', 50, 'อื่นๆ', null)],
        [2300, { html: '🤔 ยังไม่รู้จัก "ร้านป้าแดง" เลยลงหมวด อื่นๆ ไว้ก่อน — เลือกหมวดให้หน่อย ครั้งหน้าจะจำได้ครับ' }],
        [2600, quickReply(['อาหาร', 'เดินทาง', 'ช้อปปิ้ง', 'ที่พัก/บิล', 'หมวดอื่น'])],
        [4000, { press: 'อาหาร' }],
        [4400, { dropQr: true }],
        [4500, { me: 'หมวด อาหาร' }],
        [5000, { typing: true }],
        [5700, recorded('ร้านป้าแดง', 50, 'อาหาร', { pct: 65, spent: '฿1,290', limit: '฿2,000' })],
      ],
      [
        [0, { step: 2 }],
        [400, { me: 'เหลือ' }],
        [1000, { typing: true }],
        [1700, remaining],
      ],
    ],
    missing: [[
      [700, { me: 'กาแฟ' }],
      [1300, { typing: true }],
      // buildUnreadableCard() ใน errorCard.ts
      [2100, fxCard({
        title: 'อ่านข้อความไม่ออก',
        subtitle: 'ยังไม่ได้บันทึกอะไร',
        tone: 'danger',
        body: `<div style="margin-top:4px">ยังจับไม่ได้ว่ารายการนี้คืออะไรและกี่บาทครับ ใส่ชื่อรายการกับจำนวนเงินมาด้วยนะครับ</div>
          <div class="fx-title">ลองพิมพ์แบบนี้</div>
          <div class="fx-soft"><b>กาแฟ 80</b><b>ข้าว 1.2k</b><b>+เงินเดือน 15000</b></div>`,
      })],
      [2900, { tag: true }],
    ]],
    long: [[
      [900, { me: 'เมื่อวานกินข้าวกับเพื่อนหมดไปสามร้อย' }],
      [1600, { typing: true }],
      // buildPendingCard() — สรุปมาจาก describePending() ใน pending.service.ts
      [2800, fxCard({
        title: 'เข้าใจแบบนี้ถูกไหมครับ',
        subtitle: 'ยังไม่ได้บันทึก — กดยืนยันก่อนนะครับ',
        body: `<div class="fx-soft">รายจ่าย "ข้าวกับเพื่อน" ฿300.00 หมวด อาหาร วันที่ 15 พ.ย. 2569

กดยืนยันเพื่อบันทึกนะครับ</div>`,
        buttons: [['ไม่ใช่'], ['ยืนยัน', true]],
      })],
      [4400, { pressBtn: 'ยืนยัน' }],
      [4800, { me: 'ยืนยัน' }],
      [5300, { typing: true }],
      // ไม่แสดงแถบงบในช่องนี้ — ช่องแคบกว่าโทรศัพท์ในสไลด์ 4 (บอทจริงก็ไม่แสดงถ้าหมวดนั้นไม่ได้ตั้งงบ)
      [6000, recorded('ข้าวกับเพื่อน', 300, 'อาหาร', null)],
      [6400, { tag: true }],
    ]],
  };

  const chatTimers = {};

  function chatBody(name) {
    return $(`[data-chat="${name}"]`);
  }

  function stopChat(name) {
    (chatTimers[name] || []).forEach(clearTimeout);
    chatTimers[name] = [];
  }

  function runEvent(name, body, ev, instant) {
    const slide = body.closest('.slide');
    if (ev.step !== undefined) {
      $$('.step', slide).forEach((el, i) => el.classList.toggle('on', i === ev.step));
      return;
    }
    if (ev.tag) {
      $(`[data-tag="${name}"]`)?.classList.add('show');
      return;
    }
    if (ev.press) {
      const chip = $$('.qr span', body).reverse().find((el) => el.textContent === ev.press);
      chip?.classList.add('pressed');
      return;
    }
    if (ev.dropQr) {
      $$('.qr', body).forEach((el) => el.remove());
      return;
    }
    if (ev.pressBtn) {
      const btn = $$('.fx-btn', body).reverse().find((el) => el.textContent === ev.pressBtn);
      btn?.classList.add('pressed');
      return;
    }

    $$('.typing-msg', body).forEach((el) => el.remove());
    if (ev.typing && instant) return;

    const msg = document.createElement('div');
    if (ev.typing) {
      msg.className = 'msg bot typing-msg';
      msg.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    } else if (ev.me) {
      msg.className = 'msg me';
      msg.textContent = ev.me;
    } else if (ev.qr) {
      msg.className = 'msg qr';
      msg.innerHTML = ev.qr.map((label) => `<span>${label}</span>`).join('');
    } else {
      msg.className = `msg bot${ev.fx ? ' fx-msg' : ''}`;
      msg.innerHTML = ev.html;
    }
    body.appendChild(msg);
    if (instant) {
      msg.classList.add('show');
    } else {
      // setTimeout แทน requestAnimationFrame: rAF ถูกพักเมื่อแท็บ/หน้าต่างไม่ได้โฟกัส ข้อความจะค้างโปร่งใส
      setTimeout(() => msg.classList.add('show'), 30);
    }
    // แชทเริ่มจากด้านบนแล้วไหลลง — พอล้นจอค่อยเลื่อนตามข้อความใหม่ (scroll-behavior: smooth)
    // เลื่อนซ้ำเมื่อรูปในการ์ด (mascot ไอคอน) โหลดเสร็จ เพราะความสูงการ์ดเพิ่มทีหลัง ไม่งั้นท้ายการ์ดใบล่างสุดโดนตัด
    const scrollDown = () => { body.scrollTop = body.scrollHeight; };
    scrollDown();
    msg.querySelectorAll('img').forEach((img) => {
      if (!img.complete) img.addEventListener('load', scrollDown, { once: true });
    });
    setTimeout(scrollDown, 450);
    setTimeout(scrollDown, 1300);
  }

  /** เล่นแชทตั้งแต่ช่วงที่ fromSeg — ช่วงก่อนหน้าวาดทันทีไม่มีแอนิเมชัน */
  function playChat(name, fromSeg = 0) {
    const body = chatBody(name);
    // แชทจำลองเป็นไทยทั้งสองภาษา ให้ตรงกับบอทจริงและจอมือถือสด
    const script = SCRIPTS[name];
    if (!body || !script) return;
    stopChat(name);
    body.innerHTML = '';
    $(`[data-tag="${name}"]`)?.classList.remove('show');

    script.slice(0, fromSeg).forEach((seg) => seg.forEach(([, ev]) => runEvent(name, body, ev, true)));

    let offset = 600;
    const timers = [];
    script.slice(fromSeg).forEach((seg) => {
      seg.forEach(([delay, ev]) => {
        timers.push(setTimeout(() => runEvent(name, body, ev, reduceMotion), reduceMotion ? 0 : offset + delay));
      });
      offset += seg[seg.length - 1][0] + 1600;
    });
    chatTimers[name] = timers;
  }

  // คลิกขั้นเดโมเพื่อเล่นช่วงนั้นใหม่
  $$('.s-chat .step').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      playChat('demo', Number(el.dataset.step));
    });
  });
  $$('[data-replay]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      playChat(btn.dataset.replay);
    });
  });
  $$('.phone[data-follow], .panel-chat').forEach((el) => {
    el.addEventListener('click', (e) => {
      const body = $('[data-chat]', el);
      if (!body) return;
      e.stopPropagation();
      if (liveStream) return; // ตอนแชร์จอสด คลิกที่โทรศัพท์ไม่ต้องเล่นแชทจำลอง
      playChat(body.dataset.chat);
    });
  });
  function replayCurrent() {
    $$('[data-chat]', slides[current]).forEach((body) => playChat(body.dataset.chat));
  }

  // ─────────────────────── หน้าจอเว็บแบบพัด ───────────────────────
  $$('.fan-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const fan = item.parentElement;
      const was = item.classList.contains('focus');
      $$('.fan-item', fan).forEach((x) => x.classList.remove('focus'));
      if (!was) item.classList.add('focus');
      fan.classList.toggle('has-focus', !was);
    });
  });

  // ─────────────────────── ภาพขยาย ───────────────────────
  const lightbox = $('#lightbox');
  $$('[data-zoom]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      $('img', lightbox).src = el.dataset.zoom;
      lightbox.classList.add('open');
    });
  });
  lightbox.addEventListener('click', () => lightbox.classList.remove('open'));

  // ─────────────────────── Golden Thread: จุดวิ่งตามเส้นทาง FR-01 ───────────────────────
  let packetRaf = 0;
  function startPacket(slide) {
    const nodesWrap = $('.nodes', slide);
    const packet = $('.packet', slide);
    const nodes = $$('.fn', slide);
    if (!nodesWrap || !packet || reduceMotion) return;
    const t0 = performance.now();
    const loop = (now) => {
      const w = nodesWrap.clientWidth;
      const p = ((now - t0) % 5200) / 4600;
      const x = Math.min(1, p) * (w - 18);
      packet.style.left = `${x}px`;
      packet.style.opacity = p > 1 ? '0' : '1';
      const center = x + 9;
      nodes.forEach((n) => {
        const left = n.offsetLeft;
        n.classList.toggle('lit', p <= 1 && center >= left && center <= left + n.offsetWidth);
      });
      packetRaf = requestAnimationFrame(loop);
    };
    packetRaf = requestAnimationFrame(loop);
  }
  function stopPacket() {
    cancelAnimationFrame(packetRaf);
  }

  // ─────────────────────── การ์ดเอียงตามเมาส์ + พารัลแลกซ์ ───────────────────────
  $$('[data-tilt]').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--ry', `${(x - 0.5) * 10}deg`);
      card.style.setProperty('--rx', `${(0.5 - y) * 8}deg`);
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--ry', '0deg');
      card.style.setProperty('--rx', '0deg');
    });
  });

  let mouse = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => {
    mouse = { x: e.clientX / window.innerWidth - 0.5, y: e.clientY / window.innerHeight - 0.5 };
    if (reduceMotion) return;
    $$('[data-depth]').forEach((el) => {
      if (!el.classList.contains('orb') && !slides[current]?.contains(el)) return;
      const d = Number(el.dataset.depth);
      el.style.translate = `${(-mouse.x * d).toFixed(1)}px ${(-mouse.y * d).toFixed(1)}px`;
    });
    $$('.phone[data-follow]', slides[current]).forEach((p) => {
      p.style.setProperty('--py', `${(-16 + mouse.x * 14).toFixed(2)}deg`);
      p.style.setProperty('--px', `${(8 - mouse.y * 10).toFixed(2)}deg`);
    });
    wakeCursor();
  });

  // ─────────────────────── นาฬิกา ───────────────────────
  let timerStart = 0;
  function startTimerIfIdle() {
    if (!timerStart) timerStart = Date.now();
  }
  function resetTimer() {
    timerStart = Date.now();
    renderNotes();
  }
  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  function timerText() {
    const slide = slides[current];
    const sp = SPEAKERS.find((x) => x.sec === Number(slide.dataset.sec));
    const elapsed = timerStart ? (Date.now() - timerStart) / 1000 : 0;
    const over = sp && elapsed > sp.endSec;
    return {
      elapsed: fmt(elapsed),
      target: sp ? `${sp.name} ควรจบที่ ${sp.end}` : '',
      over,
      running: Boolean(timerStart),
    };
  }

  // ─────────────────────── บทพูด (ล่างจอ) ───────────────────────
  const drawer = $('#notesDrawer');
  function renderNotes() {
    const slide = slides[current];
    const sp = SPEAKERS.find((x) => x.sec === Number(slide.dataset.sec));
    const t = timerText();
    const nextTitle = slides[current + 1]?.dataset.title || '— จบ —';
    drawer.innerHTML = `
      <div class="nd-head">${current + 1}. ${slide.dataset.title}
        <span>${sp ? `ผู้พูด ${sp.sec} · ${sp.name} (${sp.start}–${sp.end})` : ''}</span>
        <span style="margin-left:auto;color:${t.over ? 'var(--amber)' : 'var(--lime)'}">⏱ ${t.running ? t.elapsed : 'กด T เริ่มจับเวลา'}</span>
        <span>ถัดไป: ${nextTitle}</span>
      </div>
      ${NOTES[current] || ''}`;
    renderPopup();
  }
  setInterval(() => {
    if (drawer.classList.contains('open') || (popup && !popup.closed)) renderNotes();
  }, 1000);

  // ─────────────────────── หน้าต่างผู้พูด (ลากไปไว้จอโน้ตบุ๊ก) ───────────────────────
  let popup = null;
  function openPopup() {
    if (popup && !popup.closed) {
      popup.focus();
      return;
    }
    popup = window.open('', 'jodtang-presenter', 'width=980,height=720');
    if (!popup) return;
    popup.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><title>บทพูด · JOD tang</title>
      <style>
        body{margin:0;padding:28px 34px;background:#0b0e09;color:#eef3e4;font-family:'Noto Sans Thai','Leelawadee UI',Tahoma,sans-serif;font-size:21px;line-height:1.7}
        .top{display:flex;align-items:center;gap:24px;margin-bottom:18px}
        .clock{font-size:64px;font-weight:700;font-variant-numeric:tabular-nums;color:#c6f432;line-height:1}
        .clock.over{color:#f5a524}
        .meta{color:#a3ad99;font-size:18px}
        .title{font-size:28px;font-weight:700;margin:6px 0 10px}
        .next{margin-top:22px;padding:14px 18px;border-radius:14px;background:#161a12;color:#a3ad99;font-size:18px}
        .btns{margin-left:auto;display:flex;gap:10px}
        button{font:inherit;font-size:18px;padding:10px 18px;border-radius:12px;border:1px solid #2f3727;background:#1a1f15;color:#eef3e4;cursor:pointer}
        button.go{background:#c6f432;color:#0f130b;border-color:transparent;font-weight:700}
        .note-do{color:#9fb5ff;font-style:italic}.note-cut{color:#f5a524}.note-sos{color:#ff6b6b}
        b{color:#fff}
      </style></head><body>
      <div class="top"><div class="clock" id="clock">0:00</div><div class="meta" id="meta"></div>
      <div class="btns"><button id="p">← ก่อนหน้า</button><button id="t">จับเวลาใหม่</button><button class="go" id="n">ถัดไป →</button></div></div>
      <div class="title" id="title"></div><div id="notes"></div><div class="next" id="next"></div>
      </body></html>`);
    popup.document.close();
    const d = popup.document;
    d.getElementById('n').onclick = nextSlide;
    d.getElementById('p').onclick = prevSlide;
    d.getElementById('t').onclick = resetTimer;
    popup.addEventListener('keydown', (e) => onKey(e, true));
    renderPopup();
  }
  function renderPopup() {
    if (!popup || popup.closed) return;
    const d = popup.document;
    const slide = slides[current];
    const sp = SPEAKERS.find((x) => x.sec === Number(slide.dataset.sec));
    const t = timerText();
    const clock = d.getElementById('clock');
    if (!clock) return;
    clock.textContent = t.running ? t.elapsed : '0:00';
    clock.classList.toggle('over', t.over);
    d.getElementById('meta').innerHTML = `สไลด์ ${current + 1}/${slides.length}<br>${sp ? `ผู้พูด ${sp.sec} · <b>${sp.name}</b> — ${t.target}` : ''}`;
    d.getElementById('title').textContent = slide.dataset.title;
    d.getElementById('notes').innerHTML = NOTES[current] || '';
    d.getElementById('next').textContent = `ถัดไป: ${slides[current + 1]?.dataset.title || '— จบ —'}`;
  }

  // ─────────────────────── ภาพรวม ───────────────────────
  const overview = $('#overview');
  const grid = $('.grid', overview);
  slides.forEach((s, i) => {
    const b = document.createElement('button');
    const sp = SPEAKERS.find((x) => x.sec === Number(s.dataset.sec));
    b.innerHTML = `<small>${String(i + 1).padStart(2, '0')} · ${sp ? sp.name : ''}</small><b></b>`;
    b.addEventListener('click', () => {
      go(i);
      overview.classList.remove('open');
    });
    grid.appendChild(b);
  });
  function toggleOverview() {
    $$('button', grid).forEach((b, i) => {
      b.classList.toggle('on', i === current);
      const title = slides[i].dataset.title;
      $('b', b).textContent = isEn() ? (window.DECK_TITLES_EN || {})[title] || title : title;
    });
    overview.classList.toggle('open');
  }

  // ─────────────────────── คีย์บอร์ด เมาส์ สัมผัส ───────────────────────
  function closePanels() {
    const anyOpen = $$('.panel.open, #lightbox.open').length > 0;
    $$('.panel.open, #lightbox.open').forEach((p) => p.classList.remove('open'));
    return anyOpen;
  }

  function onKey(e, fromPopup = false) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === 'Escape') {
      closePanels();
      $('#blackout').classList.remove('on');
      return;
    }
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) {
      e.preventDefault();
      if (!closePanels()) nextSlide();
    } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) {
      e.preventDefault();
      if (!closePanels()) prevSlide();
    } else if (k === 'Home') go(0);
    else if (k === 'End') go(slides.length - 1);
    else if (/^[1-5]$/.test(k)) {
      const i = slides.findIndex((s) => s.dataset.sec === k);
      if (i >= 0) go(i);
    } else if (k === 'n' || k === 'N') {
      drawer.classList.toggle('open');
      renderNotes();
    } else if (k === 's' || k === 'S') {
      if (!fromPopup) openPopup();
    } else if (k === 't' || k === 'T') resetTimer();
    else if (k === 'o' || k === 'O') toggleOverview();
    else if (k === 'r' || k === 'R') replayCurrent();
    else if (k === 'm' || k === 'M') {
      // getDisplayMedia ต้องเรียกจากการกดในหน้าต่างนี้เท่านั้น — กดจากหน้าต่างผู้พูดเบราว์เซอร์จะไม่ยอม
      if (fromPopup) showToast(isEn() ? 'Press M on the slide window to share the phone screen' : 'กด M ที่หน้าต่างสไลด์เพื่อแชร์จอมือถือ');
      else toggleLive();
    }
    else if (k === 'b' || k === 'B' || k === '.') $('#blackout').classList.toggle('on');
    else if (k === 'f' || k === 'F') toggleFullscreen();
    else if (k === 'l' || k === 'L') setLang(isEn() ? 'th' : 'en');
    else if (k === '?' || k === '/') $('#help').classList.toggle('open');
  }
  document.addEventListener('keydown', (e) => onKey(e));

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }

  // คลิกพื้นที่ว่าง: ครึ่งขวา = ถัดไป ครึ่งซ้าย = ย้อนกลับ (ของที่กดได้ไม่นับ)
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-tilt], .step, .fan-item, button, [data-zoom], .phone, .panel-chat, .panel, #lightbox, #notesDrawer')) return;
    if ($('#blackout').classList.contains('on')) {
      $('#blackout').classList.remove('on');
      return;
    }
    if (e.clientX > window.innerWidth / 2) nextSlide();
    else prevSlide();
  });

  let touchX = null;
  document.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 60) (dx < 0 ? nextSlide : prevSlide)();
    touchX = null;
  });

  window.addEventListener('hashchange', () => {
    const n = parseInt(location.hash.slice(1), 10);
    if (n) go(n - 1, { fromHash: true });
  });

  // ซ่อนเคอร์เซอร์เมื่อไม่ขยับเมาส์ (ไม่บังสไลด์ตอนพรีเซนต์)
  let idleTimer = 0;
  function wakeCursor() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => document.body.classList.add('idle'), 2500);
    $('#hint').style.opacity = '1';
  }
  setTimeout(() => { $('#hint').style.opacity = '0'; }, 5000);

  // ─────────────────────── จอมือถือสด (กด M) ───────────────────────
  // มิเรอร์จอ iPhone ขึ้นโน้ตบุ๊กก่อน (เช่น LetsView) แล้วให้เบราว์เซอร์ดึงหน้าต่างนั้นมาแสดงในกรอบโทรศัพท์
  // ใช้ stream เดียวกันกับทุก <video> ในสไลด์เดโม 4, 5, 9 — ไม่ต้องเลือกหน้าต่างใหม่ทุกสไลด์
  let liveStream = null;
  const liveVideos = $$('.live-video');

  // ปุ่มโผล่ในสไลด์เดโม 4, 5, 9 และสไลด์แรก (กดแชร์ไว้ก่อนเริ่มพูด จะได้ไม่ต้องรอหน้าต่างเลือกจอตอนเดโม)
  // ระหว่างแชร์ สไลด์อื่นจะเหลือแค่จุดแดงเล็ก ๆ บอกว่ายังแชร์อยู่
  function updateLiveBtn() {
    const slide = slides[current];
    const main = current === 0 || slide.dataset.live !== undefined;
    const btn = $('#liveBtn');
    btn.classList.toggle('show', main || Boolean(liveStream));
    btn.classList.toggle('mini', !main && Boolean(liveStream));
  }

  let toastTimer = 0;
  function showToast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 6000);
  }

  async function startLive() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      showToast(isEn()
        ? 'Screen sharing is not available here — open present/index.html in Chrome or Edge instead'
        : 'ที่นี่แชร์จอไม่ได้ — เปิดไฟล์ present/index.html ด้วย Chrome หรือ Edge แทน');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
      liveStream = stream;
      liveVideos.forEach((v) => {
        v.srcObject = stream;
        v.play().catch(() => {});
      });
      // กด "หยุดแชร์" ที่แถบของ Chrome ก็กลับเป็นแชทจำลองเองเหมือนกัน
      stream.getVideoTracks()[0]?.addEventListener('ended', stopLive);
      document.documentElement.classList.add('live');
      updateLiveBtn();
    } catch (err) {
      // ผู้ใช้กดยกเลิก หรือหน้านี้ไม่ได้รับสิทธิ์แชร์จอ (เช่นเปิดผ่านลิงก์ที่ฝังอยู่ในหน้าอื่น)
      showToast(isEn()
        ? 'Screen share did not start. If no picker appeared, open present/index.html in Chrome or Edge instead'
        : 'ยังไม่ได้แชร์จอ — ถ้าไม่มีหน้าต่างให้เลือกขึ้นมาเลย ให้เปิดไฟล์ present/index.html ด้วย Chrome หรือ Edge แทน');
      console.warn('getDisplayMedia failed:', err);
    }
  }

  function stopLive() {
    if (!liveStream) return;
    liveStream.getTracks().forEach((t) => t.stop());
    liveStream = null;
    liveVideos.forEach((v) => { v.srcObject = null; });
    document.documentElement.classList.remove('live');
    updateLiveBtn();
    replayCurrent();
  }

  const toggleLive = () => (liveStream ? stopLive() : startLive());
  $('#liveBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleLive();
  });

  // ─────────────────────── ฉากหลัง: คลื่นเส้นแบบ 3D ───────────────────────
  const canvas = $('#waves');
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  let DPR = 1;
  function resizeCanvas() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  const LINES = 42;
  function drawWaves(time) {
    const theme = document.documentElement.dataset.theme;
    const rgb = theme === 'light' ? '17,21,13' : '198,244,50';
    const strength = theme === 'light' ? 0.09 : theme === 'lime' ? 0.32 : 0.2;
    ctx.clearRect(0, 0, W, H);
    const t = time * 0.00025;
    const mx = mouse.x * 0.8;
    for (let j = 0; j < LINES; j++) {
      const p = j / (LINES - 1); // 0 = ไกล, 1 = ใกล้
      const depth = p * p;
      const baseY = H * 0.5 + depth * H * 0.62;
      const amp = 8 + depth * 70;
      const freq = 0.0042 - depth * 0.0022;
      ctx.beginPath();
      for (let x = -20; x <= W + 20; x += 14) {
        const y = baseY
          + Math.sin(x * freq + t * 3 + j * 0.22 + mx) * amp
          + Math.sin(x * freq * 0.37 - t * 2 + j * 0.11) * amp * 0.6;
        if (x === -20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${rgb},${(0.02 + depth * strength).toFixed(3)})`;
      ctx.lineWidth = 0.6 + depth * 1.4;
      ctx.stroke();
    }
  }
  function frame(time) {
    if (!document.hidden) drawWaves(time);
    if (!reduceMotion) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ─────────────────────── ภาษาไทย / อังกฤษ ───────────────────────
  // ข้อความไทยอยู่ใน HTML ตามเดิม ตอนเป็น EN ไล่แทนทีละข้อความด้วยตารางใน i18n.js
  // แล้วจำค่าไทยเดิมไว้ใน Map เพื่อสลับกลับได้ไม่ผิดเพี้ยน
  const EN = window.DECK_EN || {};
  const ALT_EN = window.DECK_ALT_EN || {};
  const originalText = new Map();
  const I18N_ROOTS = ['#stage', '#help', '#overview h4', '#hint'];

  function translatableTextNodes() {
    const nodes = [];
    I18N_ROOTS.forEach((sel) => {
      const root = $(sel);
      if (!root) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) =>
          n.parentElement.closest('[data-chat], [data-en], script, style, svg')
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT,
      });
      while (walker.nextNode()) nodes.push(walker.currentNode);
    });
    return nodes;
  }

  function setLang(lang) {
    const en = lang === 'en';
    document.documentElement.lang = en ? 'en' : 'th';

    translatableTextNodes().forEach((node) => {
      if (!originalText.has(node)) originalText.set(node, node.nodeValue);
      const original = originalText.get(node);
      const key = original.replace(/\s+/g, ' ').trim();
      if (!en || !key || !(key in EN)) {
        node.nodeValue = original;
        return;
      }
      const lead = original.match(/^\s*/)[0];
      const trail = original.match(/\s*$/)[0];
      node.nodeValue = `${lead}${EN[key]}${trail}`;
    });

    $$('[data-en]').forEach((el) => {
      if (el.dataset.th === undefined) el.dataset.th = el.innerHTML;
      el.innerHTML = en ? el.dataset.en : el.dataset.th;
    });

    $$('[alt], [title]').forEach((el) => {
      ['alt', 'title'].forEach((attr) => {
        const value = el.getAttribute(attr);
        if (value === null) return;
        const store = `${attr}Th`;
        if (el.dataset[store] === undefined) el.dataset[store] = value;
        const th = el.dataset[store];
        el.setAttribute(attr, en && ALT_EN[th] ? ALT_EN[th] : th);
      });
    });

    try { localStorage.setItem('jodtang-deck-lang', en ? 'en' : 'th'); } catch { /* file:// บางเครื่องปิด storage */ }
    if (current >= 0) {
      updateChrome();
      replayCurrent();
    }
  }
  $('#langBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    setLang(isEn() ? 'th' : 'en');
  });

  // ─────────────────────── เริ่ม ───────────────────────
  let startLang = new URLSearchParams(location.search).get('lang');
  if (!startLang) {
    try { startLang = localStorage.getItem('jodtang-deck-lang'); } catch { startLang = null; }
  }
  setLang(startLang === 'en' ? 'en' : 'th');
  const fromHash = parseInt(location.hash.slice(1), 10);
  go(fromHash ? fromHash - 1 : 0, { fromHash: true });
})();
