// ไฟล์นี้ทำหน้าที่อะไร: จำลองแชท LINE ให้หน้า chat.html — prototype ของ FR-01 (และ FR-03 ผ่านปุ่มลบ/เปลี่ยนหมวด)
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: M4
// ⚖️ กฎเหล็ก G2, G3
//
// ทำไมต้องมี: FR-01 เกิดในแชท LINE ซึ่งเปิดในเบราว์เซอร์ไม่ได้ เกณฑ์ M3 ขอให้ทุก Must FR "คลิกเดินได้"
// ไฟล์นี้จึงเลียนแบบพฤติกรรมของบอทจริงแบบย่อ ไม่เรียก API ใดๆ และไม่เก็บข้อมูลที่ไหน (รีเฟรชแล้วหาย)
//
// ของจริงอยู่ที่: src/utils/regexParser.ts (L1) · src/config/keywords.ts (L2) · src/line/flex/*.ts (การ์ด)
// ที่นี่เป็นแค่ "หน้าตา" — ถ้าพฤติกรรมของบอทเปลี่ยน ให้แก้ข้อความ/การ์ดที่นี่ตามด้วย
//
// ⚖️ G3: ยอดเงินทุกตัวเป็นจำนวนเต็มสตางค์ แปลงจากข้อความแบบตัดสตริง ไม่คูณ float
// ⚖️ G2: ประโยคที่ต้องให้ AI อ่าน ได้การ์ด "ยืนยัน" ก่อน — กดยืนยันถึงจะขึ้นการ์ดบันทึกแล้ว

(function () {
  const log = document.getElementById('chatLog');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatText');
  const quick = document.getElementById('chatQuick');
  if (!log || !form || !input) return;

  /** พจนานุกรมย่อ (ตัวจริง ~380 คำใน src/config/keywords.ts) */
  const KEYWORDS = [
    { words: ['กาแฟ', 'ข้าว', 'ชา', 'ก๋วยเตี๋ยว', 'ขนม', 'น้ำ'], category: 'อาหาร' },
    { words: ['วิน', 'รถ', 'bts', 'grab', 'แท็กซี่', 'น้ำมัน'], category: 'เดินทาง' },
    { words: ['ค่าหอ', 'ค่าไฟ', 'ค่าน้ำ', 'ค่าเน็ต'], category: 'ที่พัก' },
    { words: ['หนังสือ', 'ชีท', 'ค่าเทอม'], category: 'การศึกษา' },
    { words: ['เสื้อ', 'รองเท้า', 'shopee', 'lazada'], category: 'ช้อปปิ้ง' },
  ];
  const EXPENSE_CATEGORIES = ['อาหาร', 'เดินทาง', 'ที่พัก', 'การศึกษา', 'ช้อปปิ้ง', 'อื่นๆ'];

  /** งบตัวอย่าง (สตางค์) — ใช้วาดแถบงบใต้การ์ด ให้เห็นว่าจดแล้วกระทบงบทันที (FR-06) */
  const budgets = {
    'อาหาร': { spent: 295000, limit: 400000 },
    'เดินทาง': { spent: 42000, limit: 100000 },
  };

  let nextId = 1;

  // ---------- เงิน (G3) ----------

  /** "1,234.5" → 123450 สตางค์ · คืน null ถ้าไม่ใช่ตัวเลขเงินที่ถูกต้อง */
  function toSatang(text) {
    const clean = text.replace(/,/g, '');
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(clean);
    if (!match) return null;
    const baht = parseInt(match[1], 10);
    const stang = parseInt((match[2] || '0').padEnd(2, '0'), 10);
    return baht * 100 + stang;
  }

  /** 8000 → "฿80" · 123450 → "฿1,234.50" (ไม่โชว์ .00 ตามหน้าเว็บ) */
  function formatSatang(satang) {
    const baht = Math.floor(satang / 100).toLocaleString('th-TH');
    const stang = satang % 100;
    return stang === 0 ? `฿${baht}` : `฿${baht}.${String(stang).padStart(2, '0')}`;
  }

  // ---------- อ่านข้อความ (เลียนแบบ L1 + L2) ----------

  /**
   * "กาแฟ 80" / "ข้าว 1.2k" / "+เงินเดือน 15000"
   * คืน { type, name, amount, category } หรือ null ถ้าทางด่วนอ่านไม่ออก
   */
  function parseQuick(text) {
    const match = /^(\+)?\s*(.+?)\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(k|K)?\s*(บาท)?$/.exec(text.trim());
    if (!match) return null;
    let amount = toSatang(match[3]);
    if (amount === null) return null;
    if (match[4]) amount *= 1000; // 1.2k → 120 สตางค์ × 1000 = 120000 (ยังเป็นจำนวนเต็ม)
    // ⚠️ ตัวจริงตีกลับยอด <= 0 ตั้งแต่ parser (regexParser.ts) — ที่นี่ทำแบบเดียวกัน
    if (amount <= 0) return { invalid: 'zero' };

    const name = match[2].trim();
    const isIncome = Boolean(match[1]) || /เงินเดือน|รายได้|ได้เงิน/.test(name);
    if (isIncome) return { type: 'income', name, amount, category: 'รายได้' };

    const lower = name.toLowerCase();
    const hit = KEYWORDS.find((row) => row.words.some((word) => lower.includes(word)));
    return { type: 'expense', name, amount, category: hit ? hit.category : 'อื่นๆ' };
  }

  /**
   * L4 (AI) แบบจำลอง — มีบทเดียวที่เขียนไว้ล่วงหน้า
   * หน้านี้ไม่เรียก AI จริง จึงไม่เดาประโยคอื่นมั่วๆ ให้ (ประโยคอื่นได้การ์ดอ่านไม่ออกแทน)
   */
  function parseWithMockAi(text) {
    if (/สามร้อย/.test(text) && /ข้าว|กิน/.test(text)) {
      return { type: 'expense', name: 'กินข้าวกับเพื่อน', amount: 30000, category: 'อาหาร', when: 'เมื่อวาน' };
    }
    return null;
  }

  // ---------- วาด DOM (ใช้ textContent ทั้งหมด — ข้อความผู้ใช้ห้ามเข้า innerHTML) ----------

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function scrollDown() {
    log.scrollTop = log.scrollHeight;
  }

  function addUser(text) {
    log.appendChild(el('div', 'chat-msg user', text));
    scrollDown();
  }

  function addBotText(text) {
    log.appendChild(el('div', 'chat-msg bot-text', text));
    scrollDown();
  }

  function cardShell(title, subtitle, tone) {
    const card = el('div', 'chat-card');
    const head = el('div', `chat-card-head${tone === 'warn' ? ' warn' : ''}`);
    head.appendChild(el('strong', '', title));
    head.appendChild(el('small', '', subtitle));
    const body = el('div', 'chat-card-body');
    card.appendChild(head);
    card.appendChild(body);
    log.appendChild(card);
    return { card, head, body };
  }

  function footer(card, buttons) {
    const foot = el('div', 'chat-card-foot');
    buttons.forEach((spec) => {
      const btn = el('button', spec.primary ? 'primary' : '', spec.label);
      btn.type = 'button';
      btn.addEventListener('click', () => spec.onClick(btn, foot));
      foot.appendChild(btn);
    });
    card.appendChild(foot);
    return foot;
  }

  function nowLabel(when) {
    const time = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit' }).format(new Date());
    return `${when || 'วันนี้'} ${time} น.`;
  }

  function budgetBlock(body, category) {
    const budget = budgets[category];
    if (!budget) return;
    body.appendChild(el('div', 'chat-divider'));
    const row = el('div', 'chat-budget-row');
    row.appendChild(el('b', '', category));
    row.appendChild(el('span', '', `${formatSatang(budget.spent)} / ${formatSatang(budget.limit)}`));
    body.appendChild(row);
    // เปอร์เซ็นต์ใช้แค่ความกว้างแถบ ไม่ได้เอาไปคิดเงินต่อ
    const percent = Math.min(100, Math.floor((budget.spent * 100) / budget.limit));
    const bar = el('div', 'chat-bar');
    const fill = el('i', percent >= 100 ? 'over' : percent >= 80 ? 'warn' : '');
    fill.style.width = `${percent}%`;
    bar.appendChild(fill);
    body.appendChild(bar);
    if (percent >= 80) {
      body.appendChild(el('p', 'chat-time', percent >= 100 ? `⚠️ ใช้หมวด${category}ครบงบแล้ว` : `⚠️ ใช้หมวด${category}ไปแล้ว ${percent}% ของงบ`));
    }
    body.appendChild(el('div', 'chat-note', 'รอบงบ: รายเดือน (เริ่มวันที่ 1)'));
  }

  /** การ์ด "บันทึกแล้ว" — เลียนแบบ src/line/flex/recordedCard.ts */
  function addRecorded(tx) {
    tx.id = nextId++;
    if (tx.type === 'expense' && budgets[tx.category]) budgets[tx.category].spent += tx.amount;

    const { card, body } = cardShell('บันทึกแล้ว', 'อย่าลืมตรวจรายการที่บันทึกไว้นะ');
    const head = el('p');
    const pill = el('span', `chat-pill${tx.type === 'income' ? ' income' : ''}`, tx.type === 'income' ? 'รายรับ' : 'รายจ่าย');
    const catName = el('b', '', tx.category);
    head.appendChild(pill);
    head.appendChild(catName);
    body.appendChild(head);
    body.appendChild(el('div', 'chat-time', nowLabel(tx.when)));

    const item = el('div', 'chat-item');
    item.appendChild(el('span', '', tx.name));
    item.appendChild(el('b', tx.type === 'income' ? 'income' : '', formatSatang(tx.amount)));
    const edit = el('button', 'chat-icon-btn', '✏️');
    edit.type = 'button';
    edit.title = 'แก้ไขในหน้าเว็บ';
    // ของจริงเปิดหน้ารายการของรายการนั้น (uri action) — ในโหมดตัวอย่างพาไปหน้ารายการ
    edit.addEventListener('click', () => { window.location.href = 'transactions.html?preview=1'; });
    const del = el('button', 'chat-icon-btn', '🗑️');
    del.type = 'button';
    del.title = 'ลบรายการนี้';
    item.appendChild(edit);
    item.appendChild(del);
    body.appendChild(item);

    const budgetHolder = el('div');
    body.appendChild(budgetHolder);
    if (tx.type === 'expense') budgetBlock(budgetHolder, tx.category);

    let foot = null;
    if (tx.type === 'expense') {
      foot = footer(card, [{ label: 'เปลี่ยนหมวด', onClick: () => askCategory(tx, catName, budgetHolder) }]);
    }

    del.addEventListener('click', () => {
      if (card.classList.contains('void')) return;
      addUser('ลบรายการนี้');
      if (tx.type === 'expense' && budgets[tx.category]) budgets[tx.category].spent -= tx.amount;
      card.classList.add('void');
      del.disabled = true;
      edit.disabled = true;
      if (foot) foot.querySelectorAll('button').forEach((btn) => { btn.disabled = true; });
      addBotText(`ลบ ${tx.name} ${formatSatang(tx.amount)} แล้วครับ`);
    });
    scrollDown();
  }

  /** ปุ่ม "เปลี่ยนหมวด" → quick reply หมวด (FR-03 แก้รายการจากแชท) */
  function askCategory(tx, catName, budgetHolder) {
    addUser('เปลี่ยนหมวด');
    const { card, body } = cardShell('เลือกหมวดใหม่', `${tx.name} ${formatSatang(tx.amount)}`);
    body.appendChild(el('p', '', 'ครั้งหน้าระบบจะจำคำนี้ไว้ให้ (พจนานุกรมส่วนตัว L3)'));
    const foot = el('div', 'chat-card-foot');
    foot.style.flexWrap = 'wrap';
    EXPENSE_CATEGORIES.filter((name) => name !== tx.category).forEach((name) => {
      const btn = el('button', '', name);
      btn.type = 'button';
      btn.style.flex = '1 1 30%';
      btn.addEventListener('click', () => {
        foot.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        addUser(name);
        if (budgets[tx.category]) budgets[tx.category].spent -= tx.amount;
        tx.category = name;
        if (budgets[name]) budgets[name].spent += tx.amount;
        catName.textContent = name;
        budgetHolder.textContent = '';
        budgetBlock(budgetHolder, name);
        addBotText(`ย้าย ${tx.name} ไปหมวด ${name} แล้วครับ`);
      });
      foot.appendChild(btn);
    });
    card.appendChild(foot);
    scrollDown();
  }

  /** การ์ด "เข้าใจแบบนี้ถูกไหม" — เลียนแบบ src/line/flex/pendingCard.ts (⚖️ G2) */
  function addPending(tx) {
    const { card, body } = cardShell('เข้าใจแบบนี้ถูกไหมครับ', 'ยังไม่ได้บันทึก — กดยืนยันก่อนนะครับ');
    const head = el('p');
    head.appendChild(el('span', 'chat-pill', 'รายจ่าย'));
    head.appendChild(el('b', '', tx.category));
    body.appendChild(head);
    const item = el('div', 'chat-item');
    item.appendChild(el('span', '', `${tx.name} · ${tx.when}`));
    item.appendChild(el('b', '', formatSatang(tx.amount)));
    body.appendChild(item);
    body.appendChild(el('div', 'chat-time', 'อ่านโดย AI — ยอดเงินมาจากคำที่คุณพิมพ์เท่านั้น (G1)'));

    const lock = (foot) => foot.querySelectorAll('button').forEach((btn) => { btn.disabled = true; });
    footer(card, [
      {
        label: 'ไม่ใช่',
        onClick: (_btn, foot) => {
          lock(foot);
          addUser('ไม่ใช่');
          addBotText('โอเคครับ ไม่บันทึกนะ ลองพิมพ์แบบ "ชื่อ จำนวนเงิน" เช่น ข้าว 300 ได้เลย');
        },
      },
      {
        label: 'ยืนยัน',
        primary: true,
        onClick: (_btn, foot) => {
          lock(foot);
          addUser('ยืนยัน');
          addRecorded(tx);
        },
      },
    ]);
    scrollDown();
  }

  /** การ์ดอ่านไม่ออก — เลียนแบบ buildUnreadableCard() ใน src/line/flex/errorCard.ts */
  function addUnreadable() {
    const { card, body } = cardShell('อ่านข้อความไม่ออก', 'ยังไม่ได้บันทึกอะไร', 'warn');
    body.appendChild(el('p', '', 'ยังจับไม่ได้ว่ารายการนี้คืออะไรและกี่บาทครับ ใส่ชื่อรายการกับจำนวนเงินมาด้วยนะครับ'));
    const examples = el('p', 'chat-examples', 'ตัวอย่าง: ');
    ['กาแฟ 80', 'ข้าว 1.2k', '+เงินเดือน 15000'].forEach((text, index) => {
      if (index > 0) examples.appendChild(document.createTextNode(' '));
      examples.appendChild(el('code', '', text));
    });
    body.appendChild(examples);
    footer(card, [{ label: 'ดูวิธีใช้', onClick: () => say('ช่วยเหลือ') }]);
    scrollDown();
  }

  // ---------- ตัวจัดการข้อความ ----------

  function say(raw) {
    const text = String(raw || '').trim();
    if (!text) return;
    addUser(text);

    // คำสั่งตายตัว — ของจริงตอบโดยไม่แตะ AI
    if (text === 'ช่วยเหลือ') {
      addBotText('พิมพ์ "ชื่อ จำนวนเงิน" เพื่อจดรายจ่าย เช่น กาแฟ 80 · ใส่ + ข้างหน้าสำหรับรายรับ เช่น +เงินเดือน 15000 · ส่งรูปสลิปมาก็ได้');
      return;
    }
    if (/^สรุป/.test(text)) {
      addBotText('ดูสรุปเดือนนี้ได้ที่หน้า "ภาพรวม" ครับ (FR-04) — เปิดจากแถบด้านบน');
      return;
    }

    const quickResult = parseQuick(text);
    if (quickResult && quickResult.invalid) {
      addUnreadable();
      return;
    }
    if (quickResult) {
      addRecorded(quickResult);
      return;
    }

    const aiResult = parseWithMockAi(text);
    if (aiResult) {
      addPending(aiResult);
      return;
    }
    addUnreadable();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    say(input.value);
    input.value = '';
    input.focus();
  });

  if (quick) {
    quick.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-say]');
      if (btn) say(btn.dataset.say);
    });
  }

  addBotText('สวัสดีครับ 👋 พิมพ์รายจ่ายมาได้เลย เช่น "กาแฟ 80" แล้วผมจะจดให้ทันที');

  // หน้านี้เป็นหน้าจำลองเสมอ (ไม่มีข้อมูลจริงของใคร) จึงโชว์แถบ requirement ทุกครั้ง
  if (window.jodtangProtoBar) window.jodtangProtoBar.show();
})();
