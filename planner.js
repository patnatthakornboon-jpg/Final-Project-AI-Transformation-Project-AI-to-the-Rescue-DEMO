/* Rule engine + parser + floorplan + AI layer (JavaScript) — คู่ขนานกับโมดูล Python planner_*.py
 * ใช้ได้ทั้งในเบราว์เซอร์ (GitHub Pages) และ Node (compare_js.js)
 * แก้ตรรกะที่นี่ ต้องแก้ใน planner_*.py ด้วย แล้วรัน: python compare_js.py
 */
(function (root) {
  'use strict';

  const TIER_ORDER = ['basic', 'standard', 'premium'];
  const TIER_RANK = { basic: 1, standard: 2, premium: 3 };
  const ceil = (x) => Math.ceil(Math.round(x * 1e6) / 1e6); // กัน 100*1.05 = 105.00000000000001
  const r1 = (x) => Math.round((x + 1e-9) * 10) / 10;
  const g = (x) => String(Number(x.toPrecision(6)));
  const fmt = (x) => Math.round(x).toLocaleString('en-US');

  // ---------- data ----------
  let _data = null;
  function prepare(raw) {
    const by = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
    return {
      layouts: by(raw.layouts.layouts),
      rules: raw.venue_rules,
      components: by(raw.venue_rules.components),
      categories: Object.fromEntries(raw.equipment.categories.map((c) => [c.id, c.name_th])),
      categoryOrder: raw.equipment.categories.map((c) => c.id),
      items: raw.equipment.items,
      events: by(raw.event_types.event_types),
      tiers: by(raw.event_types.budget_tiers),
      prompts: raw.prompts,
    };
  }
  function getData() {
    if (!_data) _data = prepare(root.PLANNER_DATA);
    return _data;
  }

  // ---------- engine ----------
  function componentArea(rule, people) {
    if (rule.type === 'fixed') return rule.sqm;
    if (rule.type === 'per_n_people') {
      return Math.max(rule.min_units, ceil(people / rule.n)) * rule.sqm_per_unit;
    }
    for (const t of rule.tiers) if (people <= t.max_people) return t.sqm;
    throw new Error('tiered rule ไม่ครอบคลุมจำนวนคนนี้');
  }

  function itemQty(item, people, layout, total, compAreas) {
    const r = item.rule;
    switch (r.type) {
      case 'fixed': return r.qty;
      case 'per_n_people': {
        let q = Math.max(r.min_qty || 1, ceil((people / r.n) * (1 + (r.spare_ratio || 0))));
        if (r.round_even && q % 2) q += 1;
        return q;
      }
      case 'per_layout_unit': return ceil(people / layout.seats_per_unit);
      case 'per_total_area': return Math.max(r.min_qty || 1, ceil(total / r.sqm_per_unit));
      case 'per_component_area': return Math.max(1, ceil(compAreas[r.component] / r.sqm_per_unit));
      default: throw new Error('rule type ไม่รู้จัก: ' + r.type);
    }
  }

  function calc(d, people, tier, layoutId, compIds) {
    const layout = d.layouts[layoutId];
    const dens = d.tiers[tier].layout_density;
    const seating = people * layout.sqm_per_person[dens];
    const compAreas = {};
    compIds.forEach((c) => { compAreas[c] = componentArea(d.components[c].rule, people); });
    const subtotal = seating + Object.values(compAreas).reduce((a, b) => a + b, 0);
    const circRatio = d.rules.circulation_ratio[dens];
    const circulation = subtotal * circRatio;
    const total = subtotal + circulation;
    const equipment = [];
    let cost = 0;
    for (const it of d.items) {
      if (TIER_RANK[it.tier_min] > TIER_RANK[tier]) continue;
      if (it.requires_layouts && !it.requires_layouts.includes(layoutId)) continue;
      if ((it.requires_components || []).some((c) => !(c in compAreas))) continue;
      const qty = itemQty(it, people, layout, total, compAreas);
      const line = qty * it.price_thb;
      cost += line;
      equipment.push({
        id: it.id, name_th: it.name_th, category: it.category, category_th: d.categories[it.category],
        qty, unit: it.unit, unit_price: it.price_thb, total_price: line,
      });
    }
    return { layout, dens, seating, compAreas, subtotal, circRatio, circulation, total, equipment, cost };
  }

  function plan(eventType, people, tier, layout, components, budgetThb, data) {
    const d = data || getData();
    tier = tier || 'standard';
    const ev = d.events[eventType];
    if (!ev) throw new Error(`ไม่รู้จักประเภทงาน '${eventType}'`);
    if (!Number.isInteger(people)) throw new Error('จำนวนคนต้องเป็นจำนวนเต็ม');
    if (people < ev.min_people || people > ev.max_people) {
      throw new Error(`${ev.name_th} รองรับ ${fmt(ev.min_people)}-${fmt(ev.max_people)} คน (ได้ ${fmt(people)})`);
    }
    if (!d.tiers[tier]) throw new Error(`ไม่รู้จักระดับงบ '${tier}'`);
    const layoutId = layout || ev.default_layout;
    if (!ev.allowed_layouts.includes(layoutId)) {
      throw new Error(`${ev.name_th} ไม่เหมาะกับ layout '${layoutId}' (ใช้ได้: ${ev.allowed_layouts.join(', ')})`);
    }
    const compIds = Array.from(new Set(components == null ? ev.default_components : components));
    compIds.forEach((c) => { if (!d.components[c]) throw new Error(`ไม่รู้จักส่วนประกอบ '${c}'`); });
    if (budgetThb != null && !(typeof budgetThb === 'number' && budgetThb > 0)) {
      throw new Error('งบประมาณต้องเป็นตัวเลขมากกว่า 0');
    }

    const main = calc(d, people, tier, layoutId, compIds);
    const rules = d.rules;
    const tierOptions = TIER_ORDER.map((t) => {
      const c = t === tier ? main : calc(d, people, t, layoutId, compIds);
      return {
        tier: t, name_th: d.tiers[t].name_th, total_area: r1(c.total), total_cost: c.cost,
        cost_per_person: Math.round(c.cost / people), items: c.equipment.length,
      };
    });
    let budget = null;
    if (budgetThb != null) {
      const fits = tierOptions.filter((o) => o.total_cost <= budgetThb).map((o) => o.tier);
      budget = {
        budget_thb: budgetThb, within_budget: main.cost <= budgetThb,
        difference: Math.round(budgetThb - main.cost), affordable_tiers: fits,
        recommended_tier: fits.length ? fits[fits.length - 1] : null,
      };
    }
    const zones = [{ id: 'seating', name_th: 'โซนที่นั่ง', sqm: r1(main.seating) }];
    compIds.forEach((c) => zones.push({ id: c, name_th: d.components[c].name_th, sqm: r1(main.compAreas[c]) }));
    const groups = [];
    d.categoryOrder.forEach((cat) => {
      const rows = main.equipment.filter((e) => e.category === cat);
      if (rows.length) {
        groups.push({ category: cat, name_th: d.categories[cat], items: rows,
          subtotal: rows.reduce((a, r) => a + r.total_price, 0) });
      }
    });
    const layoutObj = main.layout;
    return {
      inputs: { event_type: eventType, event_name_th: ev.name_th, people, tier,
        tier_name_th: d.tiers[tier].name_th, layout: layoutId, layout_name_th: layoutObj.name_th,
        components: compIds, budget_thb: budgetThb == null ? null : budgetThb },
      area: {
        sqm_per_person: layoutObj.sqm_per_person[main.dens], seating: r1(main.seating), zones,
        subtotal: r1(main.subtotal), circulation_ratio: main.circRatio, circulation: r1(main.circulation),
        total: r1(main.total), recommended_min_venue: ceil(main.total),
      },
      equipment: main.equipment, equipment_groups: groups, total_cost: main.cost,
      cost_per_person: Math.round(main.cost / people), tier_options: tierOptions, budget,
      safety: {
        ceiling_height_min_m: rules.ceiling_height_min_m,
        exits: Math.max(rules.min_exits, ceil(people / 250)),
        exit_width_total_m: r1((people / 100) * rules.exit_width_m_per_100_people),
        toilets: ceil(people / rules.restroom_rule.people_per_toilet),
        seat_units: ceil(people / layoutObj.seats_per_unit), seat_unit_name: layoutObj.unit_name,
      },
    };
  }

  // ---------- parser (rule-based) ----------
  const EVENT_KW = {
    wedding_banquet: ['แต่งงาน', 'มงคลสมรส', 'โต๊ะจีน', 'เลี้ยงโต๊ะ', 'งานเลี้ยง', 'wedding', 'banquet', 'gala'],
    product_launch: ['เปิดตัว', 'launch'],
    exhibition: ['นิทรรศการ', 'แสดงสินค้า', 'exhibition', 'expo', 'trade show'],
    networking: ['เน็ตเวิร์ก', 'networking', 'สังสรรค์', 'ปาร์ตี้', 'party', 'mixer'],
    workshop: ['เวิร์กชอป', 'เวิร์คชอป', 'เวิร์กช็อป', 'เวิร์คช็อป', 'workshop', 'อบรม', 'training'],
    conference: ['คอนเฟอเรนซ์', 'ประชุมวิชาการ', 'conference', 'convention'],
    seminar: ['สัมมนา', 'seminar', 'ประชุม', 'meeting'],
  };
  const LAYOUT_KW = {
    theater: ['เธียเตอร์', 'theater', 'theatre', 'แถวเก้าอี้'],
    classroom: ['ห้องเรียน', 'classroom', 'โต๊ะยาว'],
    banquet: ['โต๊ะจีน', 'โต๊ะกลม', 'banquet', 'round table'],
    cabaret: ['คาบาเรต์', 'คาบาเร่ต์', 'cabaret'],
    cocktail: ['ค็อกเทล', 'cocktail', 'ยืนสังสรรค์', 'standing'],
    u_shape: ['ตัวยู', 'u-shape', 'u shape', 'ushape'],
  };
  const COMPONENT_KW = {
    stage: ['เวที', 'stage'],
    buffet: ['บุฟเฟ', 'อาหาร', 'buffet', 'catering', 'เครื่องดื่ม'],
    registration: ['ลงทะเบียน', 'registration', 'เช็คอิน', 'check-in'],
    av_booth: ['av booth', 'ห้องควบคุม', 'ควบคุมเสียง', 'ห้องมิกซ์'],
    photo_corner: ['ถ่ายรูป', 'ถ่ายภาพ', 'photo', 'โฟโต้'],
    booths: ['บูธ', 'booth'],
    lounge: ['vip', 'รับรอง', 'เลานจ์', 'lounge'],
    dance_floor: ['เต้น', 'dance'],
  };
  const TIER_KW = {
    basic: ['ประหยัด', 'basic', 'ราคาถูก', 'cheap'],
    standard: ['มาตรฐาน', 'standard', 'ปานกลาง'],
    premium: ['พรีเมียม', 'premium', 'หรูหรา', 'luxury', 'ระดับหรู'],
  };
  const MULT = { 'พัน': 1e3, 'หมื่น': 1e4, 'แสน': 1e5, 'ล้าน': 1e6, k: 1e3, m: 1e6 };
  const NUM = '(\\d[\\d,]*(?:\\.\\d+)?)';
  const UNIT = '(พัน|หมื่น|แสน|ล้าน|k(?![a-z])|m(?![a-z]))?'; // k/m ต้องไม่ตามด้วยตัวอักษร (กัน "50 more" -> 50 ล้าน)
  const PEOPLE_RE = new RegExp(NUM + '\\s*(?:คน|ท่าน|ที่นั่ง|people|persons|person|pax|guests|attendees|seats)', 'i');
  const BUDGET_RES = [
    new RegExp('(?:งบประมาณ|งบ|budget)[^\\d]{0,12}' + NUM + '\\s*' + UNIT, 'i'),
    new RegExp(NUM + '\\s*' + UNIT + '\\s*(?:บาท|baht|thb|฿)', 'i'),
    new RegExp('฿\\s*' + NUM + '\\s*' + UNIT, 'i'),
  ];
  const THAI_DIGITS = { '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4', '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9' };

  function firstByPosition(text, table) {
    let best = null;
    for (const [key, words] of Object.entries(table)) {
      for (const w of words) {
        const pos = text.indexOf(w);
        if (pos < 0) continue;
        const better = best === null || pos < best.pos ||
          (pos === best.pos && (-w.length < -best.len || (-w.length === -best.len && key < best.key)));
        if (better) best = { pos, len: w.length, key };
      }
    }
    return best ? best.key : null;
  }

  function parseRequest(text) {
    const t = String(text || '').replace(/[๐-๙]/g, (c) => THAI_DIGITS[c]).toLowerCase();
    const out = { event_type: null, people: null, tier: null, layout: null, components: [], budget_thb: null };
    let m = PEOPLE_RE.exec(t);
    if (m) out.people = Math.trunc(parseFloat(m[1].replace(/,/g, '')));
    for (const rx of BUDGET_RES) {
      m = rx.exec(t);
      if (m) {
        let v = parseFloat(m[1].replace(/,/g, ''));
        if (m[2]) v *= MULT[m[2].toLowerCase()];
        v = Math.round(v);
        if (v > 0) { out.budget_thb = v; break; }
      }
    }
    out.event_type = firstByPosition(t, EVENT_KW);
    out.layout = firstByPosition(t, LAYOUT_KW);
    out.tier = firstByPosition(t, TIER_KW);
    const tComp = t.split('av booth').join(' ');
    for (const [cid, words] of Object.entries(COMPONENT_KW)) {
      const hay = cid === 'av_booth' ? t : tComp;
      if (words.some((w) => hay.includes(w))) out.components.push(cid);
    }
    return out;
  }

  // ---------- floorplan ----------
  const BANDS = [['stage', 'av_booth', 'lounge'], ['seating', 'dance_floor'], ['registration', 'buffet', 'photo_corner', 'booths']];
  const COLORS = {
    seating: '#cfe3f7', stage: '#f5c26b', av_booth: '#d9c2f0', lounge: '#f3b8c8', dance_floor: '#b9e6d3',
    registration: '#ffe08a', buffet: '#f7b88b', photo_corner: '#c8d8f5', booths: '#d4e8a8',
  };
  const SHORT = { seating: 'ที่นั่ง', stage: 'เวที', av_booth: 'AV', lounge: 'VIP', dance_floor: 'ฟลอร์เต้น',
    registration: 'ลงทะเบียน', buffet: 'อาหาร', photo_corner: 'ถ่ายภาพ', booths: 'บูธ' };
  const ASPECT = 1.5, CHAR_W = 0.6, MIN_LABEL_H = 30, MIN_ONE_LINE_H = 16;
  const shortName = (n) => n.split('(')[0].trim();
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // เลือกป้ายที่พอดีกล่อง (sqm ไม่ระบุ = โหมด 2 บรรทัด / ระบุ = โหมด 1 บรรทัดสำหรับกล่องเตี้ย)
  function zoneLabel(id, name, widthPx, sqm) {
    const short = SHORT[id] || name;
    const options = sqm == null
      ? [[name, 13], [name, 11], [short, 11], [short, 9]]
      : [[`${name} ${g(sqm)} ตร.ม.`, 11], [`${name} ${g(sqm)}`, 11], [`${short} ${g(sqm)}`, 11], [`${short} ${g(sqm)}`, 9], [short, 9]];
    for (const [text, fs] of options) {
      if (text.length * CHAR_W * fs <= widthPx - 6) return { text, fs };
    }
    return { text: null, fs: null };
  }

  function layoutZones(zones, totalArea, subtotal) {
    const width = Math.sqrt(totalArea * ASPECT);
    const depth = totalArea / width;
    const scale = Math.sqrt(subtotal / totalArea);
    const iw = width * scale, idp = depth * scale;
    const ox = (width - iw) / 2, oy = (depth - idp) / 2;
    const byId = Object.fromEntries(zones.map((z) => [z.id, z]));
    const rects = [];
    let y = oy;
    for (const band of BANDS) {
      const members = band.filter((i) => byId[i]).map((i) => byId[i]);
      if (!members.length) continue;
      const bandArea = members.reduce((a, z) => a + z.sqm, 0);
      const h = (idp * bandArea) / subtotal;
      let x = ox;
      for (const z of members) {
        const w = (iw * z.sqm) / bandArea;
        rects.push({ id: z.id, name: shortName(z.name_th), sqm: z.sqm, x, y, w, h });
        x += w;
      }
      y += h;
    }
    return { width, depth, rects };
  }

  // สิ่งที่จะวาด (พิกเซล) — แยกไว้ให้ compare_js.py เทียบกับ Python ได้
  function scene(p, pxWidth) {
    pxWidth = pxWidth || 680;
    const a = p.area;
    const sub = a.zones.reduce((s, z) => s + z.sqm, 0);
    const { width, depth, rects } = layoutZones(a.zones, a.total, sub);
    const k = pxWidth / width;
    const boxes = rects.map((r) => {
      const wPx = r.w * k, hPx = r.h * k;
      let lines = 0, lab = { text: null, fs: null };
      if (hPx > MIN_LABEL_H) { lines = 2; lab = zoneLabel(r.id, r.name, wPx); }
      else if (hPx >= MIN_ONE_LINE_H) { lines = 1; lab = zoneLabel(r.id, r.name, wPx, r.sqm); }
      return { id: r.id, name: r.name, sqm: r.sqm, x: 20 + r.x * k, y: 20 + r.y * k, w: wPx, h: hPx, label: lab.text, fs: lab.fs, lines };
    });
    return { width, depth, k, boxes };
  }

  function floorplanSvg(p, pxWidth) {
    pxWidth = pxWidth || 680;
    const a = p.area;
    const { width, depth, k, boxes } = scene(p, pxWidth);
    const hPx = depth * k;
    const vbW = pxWidth + 40, vbH = (hPx + 70).toFixed(0);
    const font = "Sarabun,'Noto Sans Thai','Segoe UI',Tahoma,sans-serif";
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="100%" font-family="${font}" role="img" aria-label="ผังพื้นที่จัดงาน">`,
      `<rect width="${vbW}" height="${vbH}" fill="#ffffff"/>`,
      `<rect x="20" y="20" width="${pxWidth}" height="${hPx.toFixed(1)}" rx="6" fill="#fafafa" stroke="#555" stroke-width="2" stroke-dasharray="6 4"/>`,
    ];
    for (const b of boxes) {
      parts.push(`<rect x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}" fill="${COLORS[b.id] || '#ddd'}" stroke="#7a7a7a" stroke-width="1"><title>${esc(b.name + ' ' + g(b.sqm) + ' ตร.ม.')}</title></rect>`);
      if (b.label) {
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        if (b.lines === 2) {
          parts.push(`<text x="${cx.toFixed(1)}" y="${(cy - 2).toFixed(1)}" text-anchor="middle" font-size="${b.fs}" fill="#222">${esc(b.label)}</text>`);
          parts.push(`<text x="${cx.toFixed(1)}" y="${(cy + 14).toFixed(1)}" text-anchor="middle" font-size="${Math.min(12, b.fs)}" fill="#444">${g(b.sqm)} ตร.ม.</text>`);
        } else {
          parts.push(`<text x="${cx.toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="middle" font-size="${b.fs}" fill="#222">${esc(b.label)}</text>`);
        }
      }
    }
    parts.push(`<text x="${(20 + pxWidth / 2).toFixed(1)}" y="${(hPx + 40).toFixed(1)}" text-anchor="middle" font-size="13" fill="#333">▲ ทางเข้า · พื้นที่รวม ${g(a.total)} ตร.ม. (≈ ${width.toFixed(1)} × ${depth.toFixed(1)} ม., รวมทางสัญจร ${g(a.circulation)} ตร.ม.)</text>`);
    parts.push('</svg>');
    return parts.join('');
  }

  // ---------- AI layer ----------
  function buildExtractPrompt(data) {
    const d = data || getData();
    const sys = d.prompts.extract_system
      .replace('{EVENT_TYPES}', Object.keys(d.events).join(', '))
      .replace('{LAYOUTS}', Object.keys(d.layouts).join(', '))
      .replace('{COMPONENTS}', Object.keys(d.components).join(', '));
    const shots = d.prompts.extract_examples
      .map((x) => `Input: ${x.input}\nOutput: ${JSON.stringify(x.output)}`).join('\n\n');
    return { system: sys, shots };
  }

  function sanitizeRequirements(raw, data) {
    const d = data || getData();
    const out = { event_type: null, people: null, tier: null, layout: null, components: [], budget_thb: null };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    if (d.events[raw.event_type]) out.event_type = raw.event_type;
    if (d.layouts[raw.layout]) out.layout = raw.layout;
    if (d.tiers[raw.tier]) out.tier = raw.tier;
    if (typeof raw.people === 'number' && raw.people > 0) out.people = Math.trunc(raw.people);
    if (typeof raw.budget_thb === 'number' && raw.budget_thb > 0) out.budget_thb = Math.trunc(raw.budget_thb);
    if (Array.isArray(raw.components)) {
      out.components = Array.from(new Set(raw.components)).filter((c) => d.components[c]);
    }
    return out;
  }

  function extractJson(text) {
    let t = String(text).trim().replace(/^```(?:json)?|```$/gm, '').trim();
    const m = /\{[\s\S]*\}/.exec(t);
    return JSON.parse(m ? m[0] : t);
  }

  // ---- เรียก Gemini จากเบราว์เซอร์โดยตรงด้วย key ของผู้ใช้เอง (ไม่เก็บ/ไม่ส่งไปที่อื่น) ----
  const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
  const DEFAULT_MODEL = 'gemini-3.8-flash';
  const SKIP = ['preview', 'exp', 'image', 'tts', 'live', 'audio', 'embedding', 'aqa', 'thinking', 'vision', 'robotics', 'computer'];

  // รหัส HTTP + สถานะ + ข้อความจริงจาก response body (ตัด key ออก ไม่เกิน 300 ตัวอักษร)
  async function describeHttpError(res, key) {
    let detail = '';
    try {
      const j = await res.json();
      const e = j && j.error;
      if (e && typeof e === 'object') detail = [e.status, e.message].filter(Boolean).join(' ');
    } catch (_) { /* body ไม่ใช่ JSON */ }
    let text = `HTTP ${res.status}` + (detail ? ' ' + detail : res.statusText ? ' ' + res.statusText : '');
    if (key) text = text.split(key).join('***');
    return text.slice(0, 300);
  }

  async function geminiFetch(path, key, init) {
    let res;
    try {
      res = await fetch(GEMINI_BASE + path, Object.assign({ headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key } }, init));
    } catch (e) {
      throw new Error('เชื่อมต่อไม่ได้ (เครือข่ายถูกบล็อกหรือไม่มีอินเทอร์เน็ต)');
    }
    if (!res.ok) throw new Error(await describeHttpError(res, key));
    return res.json();
  }

  const workingModels = {}; // แคชในหน่วยความจำ: โมเดลที่เรียกสำเร็จของ key นั้น (เก็บเฉพาะ hash ไม่เก็บ key)
  function keyId(key) { let h = 5381; const s = String(key || ''); for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return String(h); }
  // error ที่การเปลี่ยนโมเดลอาจแก้ได้ (ไม่รวม key ผิด 400 หรือโควตา 429)
  function modelRelated(msg) { return /HTTP 404|NOT_FOUND|not found|not supported|HTTP 403|PERMISSION_DENIED/.test(msg); }

  async function generateGemini(system, user, key, model, jsonMode) {
    const gen = { temperature: 0.2 };
    if (jsonMode) gen.responseMimeType = 'application/json';
    const data = await geminiFetch(`/models/${model}:generateContent`, key, {
      method: 'POST',
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: gen,
      }),
    });
    try { // โมเดลที่คิดก่อนตอบอาจคืนหลายส่วน (ส่วน thought ไม่ใช่คำตอบ) จึงรวมทุกส่วนที่เป็นข้อความ
      return data.candidates[0].content.parts.filter((p) => !p.thought).map((p) => p.text || '').join('');
    } catch (_) {
      const why = (data.promptFeedback && JSON.stringify(data.promptFeedback)) || (data.candidates && data.candidates[0] && data.candidates[0].finishReason) || 'ไม่ทราบสาเหตุ';
      throw new Error(`AI ตอบกลับโดยไม่มีข้อความ (${String(why).slice(0, 150)})`);
    }
  }

  // ไม่ระบุโมเดล: ใช้ตัวที่เคยสำเร็จ/ค่าเริ่มต้น ถ้าล้มเหลวด้วยเหตุที่เกี่ยวกับโมเดล ดูรายการโมเดลของบัญชีแล้วลองสูงสุด 2 ตัว
  // ไม่สำเร็จก็แจ้ง error เดิม (ไม่ใช่ error ของการลองสำรอง)
  async function generateGeminiAuto(system, user, key, jsonMode) {
    const id = keyId(key);
    const first = workingModels[id] || DEFAULT_MODEL;
    let original;
    try {
      const out = await generateGemini(system, user, key, first, jsonMode);
      workingModels[id] = first;
      return out;
    } catch (e) {
      if (!modelRelated(String(e && e.message || e))) throw e;
      original = e;
    }
    let names;
    try { names = await listGeminiModels(key); } catch (_) { throw original; }
    for (const m of suggestModels(names, 3).filter((n) => n !== first).slice(0, 2)) {
      try {
        const out = await generateGemini(system, user, key, m, jsonMode);
        workingModels[id] = m;
        return out;
      } catch (_) { /* ลองตัวถัดไป */ }
    }
    throw original;
  }

  async function callGemini(system, user, key, model, jsonMode) {
    return model ? generateGemini(system, user, key, model, jsonMode) : generateGeminiAuto(system, user, key, jsonMode);
  }

  async function listGeminiModels(key) {
    const data = await geminiFetch('/models?pageSize=200', key, { method: 'GET' });
    return (data.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.split('/').pop());
  }

  function suggestModels(names, limit) {
    return names.filter((n) => n.startsWith('gemini-') && n.includes('flash') && !SKIP.some((s) => n.includes(s)))
      .sort().reverse().slice(0, limit || 5);
  }

  // ตรวจว่า key ใช้ได้ไหม และโมเดลที่จะใช้เรียกได้จริงไหม คืน { ok, text }
  async function testConnection(key, model) {
    if (!key) return { ok: false, text: 'ยังไม่ได้ใส่ API key' };
    const lines = [];
    try {
      const names = await listGeminiModels(key);
      lines.push(`key ใช้ได้ พบโมเดลที่เรียกใช้ได้ ${names.length} ตัว`);
      const explicit = !!model;
      if (explicit) { // ผู้ใช้ระบุเอง: ต้องมีในบัญชี ไม่เปลี่ยนให้เอง
        if (!names.includes(model)) {
          const sug = suggestModels(names);
          lines.push(`ไม่พบโมเดล '${model}' ในบัญชีนี้` + (sug.length ? ` — ลองใช้: ${sug.join(', ')}` : ''));
          return { ok: false, text: lines.join('\n') };
        }
      } else { // ไม่ระบุ: เลือกอัตโนมัติ เหมือนตอนใช้งานจริง
        model = workingModels[keyId(key)] || DEFAULT_MODEL;
        if (!names.includes(model)) {
          const sug = suggestModels(names);
          if (!sug.length) {
            lines.push(`ไม่พบโมเดล '${model}' และไม่มีโมเดล flash อื่นที่ใช้ได้ในบัญชีนี้`);
            return { ok: false, text: lines.join('\n') };
          }
          lines.push(`ไม่พบโมเดล '${model}' ในบัญชีนี้ — เลือก '${sug[0]}' ให้อัตโนมัติ`);
          model = sug[0];
        }
      }
      const reply = await generateGemini('Reply with the single word OK.', 'ping', key, model, false);
      workingModels[keyId(key)] = model;
      lines.push(`เรียกโมเดล '${model}' สำเร็จ (ตอบกลับ: ${reply.trim().slice(0, 40)})`);
      return { ok: true, text: lines.join('\n') };
    } catch (e) {
      lines.push('ล้มเหลว: ' + (e && e.message || e));
      return { ok: false, text: lines.join('\n') };
    }
  }

  async function extractRequirements(text, opts) {
    opts = opts || {};
    const llm = opts.llm || callGemini;
    if (opts.key) {
      try {
        const { system, shots } = buildExtractPrompt();
        const reply = await llm(system, `${shots}\n\nInput: ${text}\nOutput:`, opts.key, opts.model, true);
        return { req: sanitizeRequirements(extractJson(reply)), source: 'llm', error: null };
      } catch (e) {
        return { req: parseRequest(text), source: 'rules', error: String(e && e.message || e) };
      }
    }
    return { req: parseRequest(text), source: 'rules', error: null };
  }

  function planSummaryForLlm(p) {
    return {
      inputs: p.inputs,
      area: { seating: p.area.seating, total: p.area.total, circulation: p.area.circulation,
        recommended_min_venue: p.area.recommended_min_venue, zones: p.area.zones },
      total_cost: p.total_cost, cost_per_person: p.cost_per_person, tier_options: p.tier_options,
      budget: p.budget, safety: p.safety, equipment_count: p.equipment.length,
    };
  }

  function ruleBasedAdvice(p) {
    const i = p.inputs, a = p.area, s = p.safety;
    const tips = [
      `- แผน${i.event_name_th} ${fmt(i.people)} คน แบบ${i.layout_name_th} ใช้พื้นที่รวม ${g(a.total)} ตร.ม. ` +
        `(ที่นั่ง ${g(a.seating)} + ส่วนประกอบอื่น ${(a.subtotal - a.seating).toFixed(1)} + ทางสัญจร ${g(a.circulation)}) ` +
        `ควรหาสถานที่ไม่ต่ำกว่า ${fmt(a.recommended_min_venue)} ตร.ม.`,
      `- ความปลอดภัย: ควรมีทางออกอย่างน้อย ${s.exits} จุด ความกว้างรวมไม่ต่ำกว่า ${g(s.exit_width_total_m)} ม. ` +
        `ห้องน้ำประมาณ ${s.toilets} ที่ และเพดานสูงไม่ต่ำกว่า ${g(s.ceiling_height_min_m)} ม.`,
    ];
    if (i.components.includes('buffet')) tips.push('- โซนอาหาร: ตั้งจุดบริการแยกจากทางเข้างานและทางเดินหลักเพื่อลดคิวติดขัด');
    const b = p.budget;
    const opts = Object.fromEntries(p.tier_options.map((o) => [o.tier, o]));
    if (b) {
      if (b.within_budget) tips.push(`- งบที่ตั้งไว้ ${fmt(b.budget_thb)} บาท เพียงพอ เหลือประมาณ ${fmt(b.difference)} บาท สำหรับสำรองหน้างาน`);
      else if (b.recommended_tier) {
        const o = opts[b.recommended_tier];
        tips.push(`- งบเกินประมาณ ${fmt(-b.difference)} บาท ลองลดเป็นระดับ '${o.name_th}' (ประมาณ ${fmt(o.total_cost)} บาท) จะอยู่ในงบ`);
      } else {
        tips.push(`- แม้ระดับประหยัดก็ยังเกินงบ (ประมาณ ${fmt(opts.basic.total_cost)} บาท) ลองลดจำนวนคนหรือตัดส่วนประกอบที่ไม่จำเป็น`);
      }
    } else {
      tips.push('- ยังไม่ได้ระบุงบ: เทียบตารางระดับงบด้านล่างเพื่อเลือกที่เหมาะกับเป้าหมายงาน');
    }
    return tips.join('\n');
  }

  async function advise(p, text, opts) {
    opts = opts || {};
    const llm = opts.llm || callGemini;
    if (opts.key) {
      try {
        const user = `โจทย์ของผู้ใช้: ${text || '-'}\n\nข้อมูลแผน (JSON):\n${JSON.stringify(planSummaryForLlm(p))}`;
        const reply = await llm(getData().prompts.advise_system, user, opts.key, opts.model, false);
        if (reply && reply.trim()) return { text: reply.trim(), source: 'llm', error: null };
        throw new Error('LLM ตอบกลับว่างเปล่า');
      } catch (e) {
        return { text: ruleBasedAdvice(p), source: 'rules', error: String(e && e.message || e) };
      }
    }
    return { text: ruleBasedAdvice(p), source: 'rules', error: null };
  }

  // ---------- CSV ----------
  function checklistCsv(p) {
    const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const rows = [['หมวด', 'รายการ', 'จำนวน', 'หน่วย', 'ราคาต่อหน่วย (บาท)', 'รวม (บาท)']];
    p.equipment.forEach((e) => rows.push([e.category_th, e.name_th, e.qty, e.unit, e.unit_price, e.total_price]));
    rows.push(['', 'รวมทั้งหมด', '', '', '', p.total_cost]);
    return '﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n');
  }

  root.Planner = {
    TIER_ORDER, getData, prepare, plan, parseRequest, layoutZones, scene, zoneLabel, floorplanSvg, buildExtractPrompt,
    sanitizeRequirements, extractRequirements, advise, testConnection, suggestModels, describeHttpError, ruleBasedAdvice, planSummaryForLlm, checklistCsv,
    fmt, g,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Planner;
})(typeof window !== 'undefined' ? window : globalThis);
