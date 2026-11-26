/* ตัวเชื่อมหน้าเว็บ (index.html) เข้ากับ Planner (planner.js) */
(function () {
  'use strict';
  const P = window.Planner;
  const D = P.getData();
  const $ = (id) => document.getElementById(id);
  const EXAMPLES = [
    'งานสัมมนา 100 คน มีเวทีและซุ้มอาหาร งบ 5 หมื่นบาท',
    'งานแต่งงาน 250 คน โต๊ะจีน ระดับพรีเมียม มีฟลอร์เต้น',
    'Networking cocktail party for 80 people with buffet, budget 40k',
  ];
  const state = { event_type: 'seminar', people: 100, tier: 'standard', layout: 'theater', components: [], budget: null, plan: null, adviceText: null };

  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'text') n.textContent = v;
      else if (v === true) n.setAttribute(k, '');
      else if (v !== false && v != null) n.setAttribute(k, v);
    });
    kids.flat().forEach((c) => n.append(c));
    return n;
  };
  const baht = (n) => P.fmt(n);

  // ---------- build form ----------
  function buildStatic() {
    $('ev').replaceChildren(...Object.values(D.events).map((e) => el('option', { value: e.id, text: e.name_th })));
    $('tier').replaceChildren(...P.TIER_ORDER.map((t) => {
      const input = el('input', { type: 'radio', name: 'tier', value: t });
      return el('label', {}, input, D.tiers[t].name_th);
    }));
    $('comps').replaceChildren(...Object.values(D.components).map((c) => {
      const input = el('input', { type: 'checkbox', name: 'comp', value: c.id });
      return el('label', {}, input, c.name_th);
    }));
    $('examples').replaceChildren(...EXAMPLES.map((t) => {
      const b = el('button', { type: 'button', text: t.length > 28 ? t.slice(0, 28) + '…' : t, title: t });
      b.addEventListener('click', () => { $('intake').value = t; readText(false); });
      return b;
    }));
  }

  function syncForm() {
    const ev = D.events[state.event_type];
    $('ev').value = state.event_type;
    $('people').min = ev.min_people;
    $('people').max = ev.max_people;
    $('people').value = state.people;
    $('layout').replaceChildren(...ev.allowed_layouts.map((l) => el('option', { value: l, text: D.layouts[l].name_th })));
    $('layout').value = state.layout;
    document.querySelectorAll('input[name=tier]').forEach((r) => { r.checked = r.value === state.tier; });
    document.querySelectorAll('input[name=comp]').forEach((c) => { c.checked = state.components.includes(c.value); });
    $('budget').value = state.budget || '';
  }

  function resetForEvent(id) {
    const ev = D.events[id];
    state.event_type = id;
    state.layout = ev.default_layout;
    state.components = ev.default_components.slice();
    state.people = Math.min(Math.max(state.people, ev.min_people), ev.max_people);
  }

  // ---------- render ----------
  function render() {
    const err = $('error');
    let p;
    try {
      p = P.plan(state.event_type, state.people, state.tier, state.layout, state.components, state.budget || null);
    } catch (e) {
      err.textContent = e.message;
      err.hidden = false;
      $('out').hidden = true;
      $('out2').hidden = true;
      return;
    }
    err.hidden = true;
    $('empty').hidden = true;
    $('out').hidden = false;
    $('out2').hidden = false;
    state.plan = p;
    state.adviceText = null;

    $('plan-svg').innerHTML = P.floorplanSvg(p);
    const kpi = (label, value, unit) => el('div', {}, el('dt', { text: label }), el('dd', {}, value, unit ? el('small', { text: unit }) : ''));
    $('kpis').replaceChildren(
      kpi('พื้นที่รวมที่ต้องใช้', P.g(p.area.total), 'ตร.ม.'),
      kpi('สถานที่ควรไม่เล็กกว่า', baht(p.area.recommended_min_venue), 'ตร.ม.'),
      kpi('งบประมาณโดยประมาณ', baht(p.total_cost), 'บาท'),
      kpi('ต่อคน', baht(p.cost_per_person), 'บาท'),
      kpi('รายการอุปกรณ์', String(p.equipment.length), 'รายการ'));

    const bn = $('budget-note');
    const b = p.budget;
    if (b) {
      bn.hidden = false;
      bn.classList.toggle('over', !b.within_budget);
      if (b.within_budget) bn.textContent = `อยู่ในงบ ${baht(b.budget_thb)} บาท เหลือประมาณ ${baht(b.difference)} บาท`;
      else if (b.recommended_tier) bn.textContent = `เกินงบประมาณ ${baht(-b.difference)} บาท — ระดับ '${D.tiers[b.recommended_tier].name_th}' จะอยู่ในงบ`;
      else bn.textContent = `เกินงบประมาณ ${baht(-b.difference)} บาท และแม้ระดับประหยัดก็ยังเกิน ลองลดจำนวนคนหรือส่วนประกอบ`;
    } else bn.hidden = true;

    const th = (t, cls) => el('th', { scope: 'col', class: cls || null, text: t });
    const td = (t, cls) => el('td', { class: cls || null, text: t });
    $('tiers-table').replaceChildren(
      el('thead', {}, el('tr', {}, th('ระดับงบ'), th('พื้นที่ (ตร.ม.)', 'num'), th('งบรวม (บาท)', 'num'), th('ต่อคน', 'num'))),
      el('tbody', {}, ...p.tier_options.map((o) => {
        const tr = el('tr', { 'aria-current': o.tier === p.inputs.tier ? 'true' : null },
          td(o.name_th + (o.tier === p.inputs.tier ? ' (ที่เลือก)' : '')), td(P.g(o.total_area), 'num'), td(baht(o.total_cost), 'num'), td(baht(o.cost_per_person), 'num'));
        return tr;
      })));

    const a = p.area;
    $('zones-table').replaceChildren(
      el('thead', {}, el('tr', {}, th('โซน'), th('พื้นที่ (ตร.ม.)', 'num'))),
      el('tbody', {}, ...a.zones.map((z) => el('tr', {}, td(z.name_th), td(P.g(z.sqm), 'num'))),
        el('tr', {}, td(`ทางสัญจร (${Math.round(a.circulation_ratio * 100)}%)`), td(P.g(a.circulation), 'num'))),
      el('tfoot', {}, el('tr', {}, td('รวม'), td(P.g(a.total), 'num'))));
    const s = p.safety;
    $('safety').textContent = `ความปลอดภัยเบื้องต้น: ทางออกอย่างน้อย ${s.exits} จุด กว้างรวมไม่ต่ำกว่า ${P.g(s.exit_width_total_m)} ม. · ห้องน้ำประมาณ ${s.toilets} ที่ · เพดานสูงไม่ต่ำกว่า ${P.g(s.ceiling_height_min_m)} ม. · ${s.seat_unit_name} ${baht(s.seat_units)} ชุด`;

    $('checklist').replaceChildren(
      ...p.equipment_groups.map((g) => el('div', { class: 'group' },
        el('h3', {}, g.name_th, el('span', { text: `${baht(g.subtotal)} บาท` })),
        el('table', {},
          el('thead', {}, el('tr', {}, th('รายการ'), th('จำนวน', 'num'), th('หน่วย'), th('ราคา/หน่วย', 'num'), th('รวม (บาท)', 'num'))),
          el('tbody', {}, ...g.items.map((e) => el('tr', {}, td(e.name_th), td(baht(e.qty), 'num'), td(e.unit), td(baht(e.unit_price), 'num'), td(baht(e.total_price), 'num'))))))),
      el('p', {}, el('strong', { text: `รวมทั้งหมด ${baht(p.total_cost)} บาท` })));

    showAdvice(P.ruleBasedAdvice(p), null);
    $('btn-advice').hidden = !aiKey();
  }

  function showAdvice(text, note) {
    $('advice').replaceChildren(...text.split('\n').filter(Boolean).map((l) => el('li', { text: l.replace(/^[-*•]\s*/, '') })));
    $('advice-src').textContent = note || (aiKey() ? 'คำแนะนำจากแม่แบบ — กดปุ่มด้านล่างเพื่อให้ AI เขียนเฉพาะแผนนี้' : 'คำแนะนำจากแม่แบบ (ไม่ได้ใช้ AI) — ใส่ Gemini API key เพื่อให้ AI เขียนคำแนะนำเฉพาะงานนี้');
  }

  const aiKey = () => $('ai-key').value.trim() || null;
  const aiModel = () => $('ai-model').value.trim() || undefined;

  // ---------- events ----------
  function readForm() {
    state.event_type = $('ev').value;
    state.people = parseInt($('people').value, 10);
    state.layout = $('layout').value;
    const t = document.querySelector('input[name=tier]:checked');
    state.tier = t ? t.value : 'standard';
    state.components = Array.from(document.querySelectorAll('input[name=comp]:checked')).map((c) => c.value);
    const b = parseFloat($('budget').value);
    state.budget = b > 0 ? b : null;
  }

  async function readText(auto) {
    auto = auto === true; // true = อ่านอัตโนมัติขณะพิมพ์ (rule-based เท่านั้น ไม่เรียก AI)
    const btn = $('btn-read'), status = $('intake-status'), notices = $('intake-notices');
    if (!$('intake').value.trim()) { // ยังไม่ได้พิมพ์อะไร: ไม่คำนวณจากค่าเดา
      if (auto) { status.textContent = ''; return; }
      status.textContent = 'ยังไม่ได้พิมพ์โจทย์ — พิมพ์รายละเอียดงานก่อน หรือกดตัวอย่างด้านล่าง';
      notices.replaceChildren();
      return;
    }
    if (!auto) btn.disabled = true;
    status.textContent = !auto && aiKey() ? 'กำลังให้ AI อ่านโจทย์…' : 'กำลังอ่านโจทย์…';
    notices.replaceChildren();
    const snapshot = $('intake').value;
    try {
      const r = await P.extractRequirements(snapshot, auto ? { key: '' } : { key: aiKey(), model: aiModel() });
      if (auto && snapshot !== $('intake').value) return; // พิมพ์ต่อแล้ว ผลนี้เก่าไปแล้ว
      const req = r.req, msgs = [];
      if (req.event_type) state.event_type = req.event_type;
      const ev = D.events[state.event_type];
      state.layout = ev.allowed_layouts.includes(req.layout) ? req.layout : ev.default_layout;
      if (req.layout && !ev.allowed_layouts.includes(req.layout)) msgs.push(`${ev.name_th} ไม่รองรับ layout ที่ระบุ จึงใช้ค่าเริ่มต้นแทน`);
      state.components = Array.from(new Set(ev.default_components.concat(req.components)));
      if (req.people) {
        const n = Math.min(Math.max(req.people, ev.min_people), ev.max_people);
        if (n !== req.people) msgs.push(`${ev.name_th} รองรับ ${baht(ev.min_people)}-${baht(ev.max_people)} คน จึงปรับจาก ${baht(req.people)} เป็น ${baht(n)}`);
        state.people = n;
      } else state.people = Math.min(Math.max(state.people, ev.min_people), ev.max_people);
      state.tier = req.tier || 'standard'; // โจทย์ใหม่ที่ไม่ระบุระดับงบ ต้องไม่ค้างค่าจากโจทย์เก่า
      state.budget = req.budget_thb || null;
      const found = Object.values(req).filter((v) => v !== null && !(Array.isArray(v) && !v.length)).length;
      status.textContent = `อ่านโดย${r.source === 'llm' ? ' AI (Gemini)' : 'ตัวอ่านโจทย์แบบ rule-based'}: พบ ${found} ข้อมูล ตรวจและแก้ในฟอร์มได้` + (auto && aiKey() ? ' (กด "อ่านโจทย์" เพื่อให้ AI อ่านซ้ำ)' : '');
      if (r.error) msgs.push(`เรียก AI ไม่สำเร็จ (${r.error}) จึงใช้ตัวอ่านโจทย์แบบ rule-based แทน`);
      notices.replaceChildren(...msgs.map((m) => el('li', { text: m })));
    } finally {
      if (!auto) btn.disabled = false;
    }
    syncForm();
    render();
  }

  async function askAi() {
    if (!state.plan) return;
    const btn = $('btn-advice');
    btn.disabled = true;
    $('advice-src').textContent = 'กำลังให้ AI วิเคราะห์…';
    try {
      const r = await P.advise(state.plan, $('intake').value, { key: aiKey(), model: aiModel() });
      showAdvice(r.text, r.source === 'llm' ? 'เขียนโดย AI (Gemini) จากตัวเลขที่คำนวณแล้วเท่านั้น' : `เรียก AI ไม่สำเร็จ (${r.error}) จึงแสดงคำแนะนำแบบแม่แบบแทน`);
    } finally {
      btn.disabled = false;
    }
  }

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = el('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function init() {
    buildStatic();
    resetForEvent('seminar');
    syncForm();
    $('ev').addEventListener('change', () => { resetForEvent($('ev').value); syncForm(); render(); });
    ['people', 'layout', 'budget'].forEach((id) => $(id).addEventListener('input', () => { readForm(); render(); }));
    $('layout').addEventListener('change', () => { readForm(); render(); });
    $('tier').addEventListener('change', () => { readForm(); render(); });
    $('comps').addEventListener('change', () => { readForm(); render(); });
    $('btn-test').addEventListener('click', async () => {
      const btn = $('btn-test'), out = $('ai-test');
      btn.disabled = true;
      out.hidden = false;
      out.className = 'ai-test';
      out.textContent = 'กำลังตรวจ key และโมเดล…';
      try {
        const r = await P.testConnection(aiKey(), aiModel());
        out.textContent = r.text;
        out.classList.toggle('bad', !r.ok);
      } finally {
        btn.disabled = false;
      }
    });
    $('btn-read').addEventListener('click', () => readText(false));
    let typingTimer = null; // พิมพ์เสร็จแล้วรอ 0.5 วินาที ฟอร์มและผลด้านล่างจะอัปเดตเอง
    $('intake').addEventListener('input', () => { clearTimeout(typingTimer); typingTimer = setTimeout(() => readText(true), 500); });
    $('btn-advice').addEventListener('click', askAi);
    $('ai-key').addEventListener('input', () => { $('btn-advice').hidden = !aiKey() || !state.plan; if (state.plan) showAdvice(P.ruleBasedAdvice(state.plan), null); });
    $('btn-csv').addEventListener('click', () => state.plan && download('event_checklist.csv', P.checklistCsv(state.plan), 'text/csv;charset=utf-8'));
    $('btn-print').addEventListener('click', () => window.print());
  }

  init();
})();
