// ไฟล์นี้ทำหน้าที่อะไร: แถบบนสุดที่บอกว่า "หน้าจอนี้ตอบ requirement ข้อไหน"
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W6 (Milestone 3)
//
// ทำไมต้องมี: เกณฑ์ M3 ให้คะแนนข้อ "ชี้ได้ว่าหน้าจอไหน = FR ไหน"
// ถ้าไม่ติดป้ายไว้ คนตรวจต้องเดาเองว่าการ์ดใบไหนมาจาก requirement ข้อไหน
// (ดูตัวอย่าง CoffeeAI ในภาคผนวกของเกณฑ์ — เขาทำแถบดำบนสุดแบบนี้เหมือนกัน)
//
// รายชื่อ FR อ่านจาก data-covers บน <body> ของแต่ละหน้า
// นิยามเต็มของทุก FR อยู่ใน docs/SRS.md §4 — ที่นี่เก็บแค่ชื่อสั้นไว้โชว์
//
// ⚠️ แถบนี้เป็นของสำหรับการตรวจงาน ไม่ใช่ฟีเจอร์ของผู้ใช้
// จึงปิดได้และจำค่าไว้ เพื่อให้คนที่ใช้จริงไม่ต้องเห็นตลอดเวลา

(function () {
  const HIDE_KEY = 'jodtang.protoBarHidden';

  /** ชื่อย่อของแต่ละ FR — ต้องตรงกับ docs/SRS.md §4 เสมอ */
  const FR_TITLE = {
    'FR-01': 'จดรายการจากข้อความแชท',
    'FR-02': 'จดรายการจากอีเมลธนาคาร',
    'FR-03': 'เพิ่ม / แก้ / ลบ รายการ',
    'FR-04': 'ดูสรุปยอดและกราฟ',
    'FR-05': 'ใช้ได้วันละเท่าไหร่ (safe-to-spend)',
    'FR-06': 'งบรายหมวด + เตือน 80% / 100%',
    'FR-07': 'แผนออม 3 ทางเลือก',
    'FR-08': 'โอนเข้าแผน + ติดตามความคืบหน้า',
    'FR-09': 'รายการประจำ',
    'FR-10': 'จัดการหมวดหมู่',
    'FR-11': 'คำสั่งข้อความใน LINE',
    'FR-12': 'แจ้งเตือน push + โควตา',
    'FR-13': 'สร้างที่อยู่อีเมลใหม่ (rotate token)',
    'FR-14': 'AI ช่วยตีความข้อความ',
    'FR-15': 'อ่านสลิปจากรูป',
    'FR-16': 'จำลองผลกระทบก่อนซื้อ',
    'FR-17': 'สรุปรายวัน',
    'FR-18': 'Rich Menu',
    'FR-19': 'กราฟแนวโน้ม 6 เดือน',
    'FR-20': 'กันรายการซ้ำข้ามช่องทาง',
  };

  /** ระดับ MoSCoW ใช้เลือกสีชิป — Must ต้องเด่นกว่าเพราะเป็นตัวที่ถูกตรวจ */
  const MUST = new Set(['FR-01', 'FR-02', 'FR-03', 'FR-04', 'FR-05', 'FR-06', 'FR-07', 'FR-08']);
  const SHOULD = new Set(['FR-09', 'FR-10', 'FR-11', 'FR-12', 'FR-13', 'FR-14']);

  function levelOf(id) {
    if (MUST.has(id)) return 'must';
    if (SHOULD.has(id)) return 'should';
    return 'could';
  }

  const SCREENS = [
    { href: 'prototype.html', label: 'Index' },
    { href: 'index.html', label: 'ภาพรวม' },
    { href: 'transactions.html', label: 'รายการ' },
    { href: 'categories.html', label: 'หมวดหมู่' },
    { href: 'analyze.html', label: 'วิเคราะห์' },
    { href: 'settings.html', label: 'ตั้งค่า' },
  ];

  function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (ch) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
  }

  function isHidden() {
    try {
      return window.localStorage.getItem(HIDE_KEY) === '1';
    } catch (error) {
      return false;
    }
  }

  function setHidden(hidden) {
    try {
      if (hidden) window.localStorage.setItem(HIDE_KEY, '1');
      else window.localStorage.removeItem(HIDE_KEY);
    } catch (error) {
      // เก็บค่าไม่ได้ก็ยังพับ/กางได้ในรอบนี้ แค่ไม่ถูกจำ
    }
  }

  function currentFile() {
    const path = window.location.pathname;
    const file = path.slice(path.lastIndexOf('/') + 1);
    return file || 'index.html';
  }

  function build() {
    // อ่านจาก data-covers เช่น data-covers="FR-04, FR-05"
    const raw = document.body.dataset.covers || '';
    const ids = raw.split(',').map((item) => item.trim()).filter(Boolean);

    const here = currentFile();
    const nav = SCREENS.map((screen) => {
      const active = screen.href === here;
      return `<a class="proto-nav-link ${active ? 'active' : ''}" href="${screen.href}">${escapeHtml(screen.label)}</a>`;
    }).join('');

    // หน้าสารบัญไม่ได้ตอบ FR ข้อไหนเอง — มันคือแผนที่ ไม่ใช่หน้าจอของผู้ใช้
    const isIndexPage = document.body.dataset.page === 'prototype';

    const chips = isIndexPage
      ? '<span class="proto-chip could">สารบัญหน้าจอ — ไม่ใช่หน้าจอของผู้ใช้</span>'
      : ids.length
      ? ids.map((id) => {
        const title = FR_TITLE[id] || '';
        return `<span class="proto-chip ${levelOf(id)}" title="${escapeHtml(title)}">${escapeHtml(id)}<small>${escapeHtml(title)}</small></span>`;
      }).join('')
      : '<span class="proto-chip none">หน้านี้ยังไม่ได้ผูกกับ FR</span>';

    const bar = document.createElement('div');
    bar.className = 'proto-bar';
    bar.id = 'protoBar';
    bar.innerHTML = `
      <div class="proto-bar-inner">
        <div class="proto-row proto-row-nav">
          <span class="proto-tag">PROTOTYPE · M3</span>
          <nav class="proto-nav">${nav}</nav>
          <button type="button" class="proto-toggle" id="protoToggle" aria-label="ซ่อนแถบ requirement">ซ่อน</button>
        </div>
        <div class="proto-row proto-row-covers">
          <span class="proto-covers-label">Covers:</span>
          <div class="proto-chips">${chips}</div>
        </div>
      </div>
    `;

    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'proto-pill';
    pill.id = 'protoPill';
    pill.textContent = 'FR';
    pill.setAttribute('aria-label', 'แสดงแถบ requirement');

    // แทรกไว้บนสุดของหน้า ก่อน .app-shell
    document.body.insertBefore(pill, document.body.firstChild);
    document.body.insertBefore(bar, document.body.firstChild);

    function apply(hidden) {
      bar.hidden = hidden;
      pill.hidden = !hidden;
      document.body.classList.toggle('has-proto-bar', !hidden);
    }

    apply(isHidden());

    document.getElementById('protoToggle').addEventListener('click', () => {
      setHidden(true);
      apply(true);
    });
    pill.addEventListener('click', () => {
      setHidden(false);
      apply(false);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
