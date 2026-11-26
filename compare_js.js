// ตัวช่วยของ compare_js.py: รับ {texts, scenarios} ทาง stdin รันด้วย JS engine แล้วพิมพ์ผลเป็น JSON
const path = require('path');
require(path.join(__dirname, 'data.js'));
const P = require(path.join(__dirname, 'planner.js'));

let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  const { texts, scenarios } = JSON.parse(input);
  const parsed = texts.map((t) => P.parseRequest(t));
  const plans = scenarios.map((s) => {
    try {
      const p = P.plan(s.event_type, s.people, s.tier, s.layout, s.components, s.budget_thb);
      const sub = p.area.zones.reduce((a, z) => a + z.sqm, 0);
      const fz = P.layoutZones(p.area.zones, p.area.total, sub);
      return {
        ok: true, total_area: p.area.total, seating: p.area.seating, total_cost: p.total_cost,
        equipment: p.equipment.map((e) => [e.id, e.qty]), tier_options: p.tier_options.map((o) => [o.total_cost, o.total_area]),
        budget: p.budget, safety: p.safety, rects: fz.rects.map((r) => [r.id, r.x, r.y, r.w, r.h]),
        boxes: P.scene(p).boxes.map((b) => [b.id, b.x, b.y, b.w, b.h, b.label, b.fs, b.lines]),
        svg_ok: P.floorplanSvg(p).startsWith('<svg'),
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
  process.stdout.write(JSON.stringify({ parsed, plans }));
});
