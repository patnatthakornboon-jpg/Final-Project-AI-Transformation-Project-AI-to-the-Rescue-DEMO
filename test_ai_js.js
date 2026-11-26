// ทดสอบชั้น AI ฝั่ง JavaScript ด้วย fetch ปลอมที่เลียนรูปแบบ error จริงของ Google (รันผ่าน test_engine.py)
const path = require('path');
const assert = require('assert');
require(path.join(__dirname, 'data.js'));
const P = require(path.join(__dirname, 'planner.js'));

const KEY = 'SECRETKEY123';
const reply = (status, body, statusText) => ({ ok: status < 400, status, statusText: statusText || '', json: async () => body });
const MODELS = { models: [
  { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
  { name: 'models/gemini-3.6-flash', supportedGenerationMethods: ['generateContent'] },
  { name: 'models/gemini-3-flash-preview', supportedGenerationMethods: ['generateContent'] },
  { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
] };

(async () => {
  // 1) key ไม่ถูกต้อง (Google ตอบ 400) -> ต้องเห็นเหตุผลจริง, key ต้องไม่หลุด, และ fallback เป็น rules
  globalThis.fetch = async () => reply(400, { error: { code: 400, status: 'INVALID_ARGUMENT', message: `API key not valid. Please pass a valid API key. (${KEY})` } }, 'Bad Request');
  let r = await P.extractRequirements('สัมมนา 50 คน', { key: KEY });
  assert.strictEqual(r.source, 'rules');
  assert.strictEqual(r.req.people, 50);
  assert.ok(/HTTP 400/.test(r.error) && /INVALID_ARGUMENT/.test(r.error) && /API key not valid/.test(r.error), r.error);
  assert.ok(!r.error.includes(KEY), 'key หลุดในข้อความ error');

  // 2) 403 โปรเจกต์ถูกปฏิเสธ
  globalThis.fetch = async () => reply(403, { error: { code: 403, status: 'PERMISSION_DENIED', message: 'Your project has been denied access. Please contact support.' } }, 'Forbidden');
  const a = await P.advise(P.plan('seminar', 50, 'standard'), '', { key: KEY });
  assert.strictEqual(a.source, 'rules');
  assert.ok(/HTTP 403 PERMISSION_DENIED Your project has been denied access/.test(a.error), a.error);

  // 3) response ที่ไม่ใช่ JSON ยังต้องได้รหัส HTTP
  globalThis.fetch = async () => ({ ok: false, status: 502, statusText: 'Bad Gateway', json: async () => { throw new Error('not json'); } });
  r = await P.testConnection(KEY);
  assert.ok(!r.ok && /HTTP 502 Bad Gateway/.test(r.text), r.text);

  // 4) เครือข่ายล่ม
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  r = await P.testConnection(KEY);
  assert.ok(!r.ok && /เชื่อมต่อไม่ได้/.test(r.text), r.text);

  // 5) key ใช้ได้ แต่ไม่มีโมเดลที่ขอ -> ต้องแนะนำโมเดลที่ใช้ได้จริง (ไม่รวม preview/embedding)
  globalThis.fetch = async () => reply(200, MODELS);
  r = await P.testConnection(KEY, 'gemini-2.5-flash');
  assert.ok(!r.ok && /พบโมเดลที่เรียกใช้ได้ 3 ตัว/.test(r.text) && /gemini-3\.8-flash, gemini-3\.6-flash/.test(r.text), r.text);
  assert.ok(!/preview|embedding/.test(r.text.split('ลองใช้:')[1]), 'แนะนำโมเดล preview/embedding');

  // 6) ทุกอย่างปกติ + คำตอบหลายส่วน (มีส่วน thought) ต้องรวมเฉพาะส่วนที่เป็นคำตอบ
  globalThis.fetch = async (url) => /generateContent/.test(url)
    ? reply(200, { candidates: [{ content: { parts: [{ text: 'กำลังคิด...', thought: true }, { text: 'O' }, { text: 'K' }] } }] })
    : reply(200, MODELS);
  r = await P.testConnection(KEY);
  assert.ok(r.ok && /ตอบกลับ: OK\)/.test(r.text), r.text);

  // 7) โหมด LLM สำเร็จ: ผ่าน sanitize และใช้ค่าจาก AI
  globalThis.fetch = async () => reply(200, { candidates: [{ content: { parts: [{ text: '```json\n{"event_type":"workshop","people":30,"components":["stage","x"]}\n```' }] } }] });
  r = await P.extractRequirements('อะไรก็ได้', { key: KEY });
  assert.strictEqual(r.source, 'llm');
  assert.deepStrictEqual([r.req.event_type, r.req.people, r.req.components], ['workshop', 30, ['stage']]);

  // 8) AI ตอบกลับว่าง (เช่น ถูกบล็อก) -> ข้อความต้องบอกสาเหตุ ไม่ใช่ TypeError
  globalThis.fetch = async () => reply(200, { promptFeedback: { blockReason: 'SAFETY' } });
  r = await P.extractRequirements('สัมมนา 50 คน', { key: KEY });
  assert.strictEqual(r.source, 'rules');
  assert.ok(/ตอบกลับโดยไม่มีข้อความ/.test(r.error) && /SAFETY/.test(r.error), r.error);

  // 9) ไม่ระบุโมเดล: โมเดลแรก 404 -> ลองโมเดลสำรองจากรายการของบัญชี แล้วจำไว้ (ไม่ลองซ้ำ)
  {
    const KEY2 = 'AUTOKEY456';
    const urls = [];
    const gen = (model) => reply(200, { candidates: [{ content: { parts: [{ text: '{"event_type":"workshop","people":30}' }] } }] });
    globalThis.fetch = async (url) => {
      urls.push(url);
      if (/generateContent/.test(url)) {
        return /gemini-3\.6-flash/.test(url) ? gen() : reply(404, { error: { code: 404, status: 'NOT_FOUND', message: 'model is not found' } }, 'Not Found');
      }
      return reply(200, MODELS);
    };
    r = await P.extractRequirements('อะไรก็ได้', { key: KEY2 });
    assert.strictEqual(r.source, 'llm', r.error);
    assert.ok(/gemini-3\.8-flash:generateContent/.test(urls[0]));
    const n = urls.length;
    r = await P.extractRequirements('อะไรก็ได้', { key: KEY2 });
    assert.strictEqual(r.source, 'llm');
    assert.strictEqual(urls.length - n, 1, 'ครั้งที่สองต้องใช้โมเดลที่จำไว้ตรง ๆ');
    assert.ok(/gemini-3\.6-flash:generateContent/.test(urls[urls.length - 1]));
  }

  // 10) ระบุโมเดลเอง: ห้ามเปลี่ยนให้ และ key ผิด (400) ห้ามไล่ลองโมเดลอื่น
  {
    const urls = [];
    globalThis.fetch = async (url) => { urls.push(url); return reply(404, { error: { code: 404, status: 'NOT_FOUND', message: 'nope' } }, 'Not Found'); };
    r = await P.extractRequirements('สัมมนา 50 คน', { key: 'K3', model: 'gemini-2.5-flash' });
    assert.strictEqual(r.source, 'rules');
    assert.ok(/NOT_FOUND/.test(r.error));
    assert.strictEqual(urls.length, 1);
    urls.length = 0;
    globalThis.fetch = async (url) => { urls.push(url); return reply(400, { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid.' } }, 'Bad Request'); };
    r = await P.extractRequirements('สัมมนา 50 คน', { key: 'K4' });
    assert.ok(/INVALID_ARGUMENT/.test(r.error));
    assert.strictEqual(urls.length, 1);
  }

  // 11) ทดสอบการเชื่อมต่อแบบไม่ระบุโมเดล: ถ้าตัวเริ่มต้นไม่มีในบัญชี ให้เลือกตัวที่ใช้ได้ให้อัตโนมัติ
  globalThis.fetch = async (url) => /generateContent/.test(url)
    ? reply(200, { candidates: [{ content: { parts: [{ text: 'OK' }] } }] })
    : reply(200, { models: [{ name: 'models/gemini-3.6-flash', supportedGenerationMethods: ['generateContent'] }] });
  r = await P.testConnection('K5');
  assert.ok(r.ok && /เลือก 'gemini-3\.6-flash' ให้อัตโนมัติ/.test(r.text), r.text);

  console.log('test_ai_js: ผ่านทั้ง 11 กรณี');
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
