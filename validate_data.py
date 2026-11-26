#!/usr/bin/env python3
"""ตรวจสอบความถูกต้องของไฟล์ data ทั้งหมดในไฟล์ .json

รัน:  python validate_data.py
คืนค่า exit code 0 ถ้าผ่านทั้งหมด, 1 ถ้ามีข้อผิดพลาด
"""
import json
import re
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent
DENSITIES = ("tight", "standard", "comfort")
TIERS = ("basic", "standard", "premium")
RULE_TYPES = {"fixed", "per_n_people", "per_layout_unit", "per_total_area", "per_component_area"}
COMPONENT_RULE_TYPES = {"tiered_by_people", "per_n_people", "fixed"}
# อนุญาตเฉพาะอักษรไทย อังกฤษ ตัวเลข และเครื่องหมายทั่วไป (กันอักขระปนจากภาษาอื่น)
ALLOWED_TEXT = re.compile(r"^[\u0E00-\u0E7FA-Za-z0-9\s\-\+\(\)/.,&:]+$")

errors, warnings = [], []


def err(msg):
    errors.append(msg)


def load(name):
    path = DATA_DIR / name
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        err(f"{name}: ไม่พบไฟล์")
    except json.JSONDecodeError as e:
        err(f"{name}: JSON ไม่ถูกต้อง ({e})")
    return None


def check_text(where, text):
    if not isinstance(text, str) or not text.strip():
        err(f"{where}: ข้อความว่างหรือไม่ใช่ string")
    elif not ALLOWED_TEXT.match(text):
        bad = sorted({c for c in text if not ALLOWED_TEXT.match(c)})
        err(f"{where}: พบอักขระผิดปกติ {bad} ใน '{text}'")


def unique_ids(items, label):
    seen = set()
    for it in items:
        i = it.get("id")
        if not i:
            err(f"{label}: มีรายการที่ไม่มี id")
        elif i in seen:
            err(f"{label}: id ซ้ำ '{i}'")
        seen.add(i)
    return seen


def positive(where, v, integer=False):
    ok = isinstance(v, (int, float)) and not isinstance(v, bool) and v > 0
    if ok and integer and int(v) != v:
        ok = False
    if not ok:
        err(f"{where}: ต้องเป็นจำนวนบวก{'เต็ม' if integer else ''} (ได้ {v!r})")


def main():
    layouts = load("layouts.json")
    rules = load("venue_rules.json")
    equip = load("equipment.json")
    events = load("event_types.json")
    if None in (layouts, rules, equip, events):
        return report()

    # ---- layouts ----
    layout_ids = unique_ids(layouts["layouts"], "layouts")
    for l in layouts["layouts"]:
        w = f"layouts[{l.get('id')}]"
        check_text(w + ".name_th", l.get("name_th"))
        sp = l.get("sqm_per_person", {})
        prev = 0
        for d in DENSITIES:
            if d not in sp:
                err(f"{w}: ขาด sqm_per_person.{d}")
                continue
            positive(f"{w}.sqm_per_person.{d}", sp[d])
            if sp[d] < prev:
                err(f"{w}: ค่าพื้นที่ต่อคนต้องเพิ่มขึ้น tight<=standard<=comfort")
            prev = sp[d]
        positive(w + ".seats_per_unit", l.get("seats_per_unit"), integer=True)
        if not isinstance(l.get("has_tables"), bool):
            err(f"{w}: has_tables ต้องเป็น true/false")
        # ตรวจความสมเหตุสมผล: หน่วยที่เป็น "โต๊ะ" ต้องรองรับหลายคน (กันบั๊กโต๊ะยาว 1 ตัวต่อ 1 คน)
        if "โต๊ะ" in str(l.get("unit_name", "")) and l.get("seats_per_unit", 0) < 2:
            err(f"{w}: unit_name เป็นโต๊ะ แต่ seats_per_unit < 2 (โต๊ะต้องรองรับหลายคน)")

    # ---- venue_rules ----
    for d in DENSITIES:
        if d not in rules.get("circulation_ratio", {}):
            err(f"venue_rules: ขาด circulation_ratio.{d}")
        else:
            r = rules["circulation_ratio"][d]
            if not (0 < r < 1):
                err(f"venue_rules.circulation_ratio.{d}: ต้องอยู่ระหว่าง 0-1")
    comp_ids = unique_ids(rules["components"], "venue_rules.components")
    for c in rules["components"]:
        w = f"component[{c.get('id')}]"
        check_text(w + ".name_th", c.get("name_th"))
        r = c.get("rule", {})
        t = r.get("type")
        if t not in COMPONENT_RULE_TYPES:
            err(f"{w}: rule.type ไม่รู้จัก '{t}'")
        elif t == "fixed":
            positive(w + ".sqm", r.get("sqm"))
        elif t == "per_n_people":
            positive(w + ".n", r.get("n"), True)
            positive(w + ".sqm_per_unit", r.get("sqm_per_unit"))
            positive(w + ".min_units", r.get("min_units"), True)
        elif t == "tiered_by_people":
            tiers = r.get("tiers", [])
            if not tiers:
                err(f"{w}: tiers ว่าง")
            last = 0
            for tr in tiers:
                if tr["max_people"] <= last:
                    err(f"{w}: max_people ต้องเรียงจากน้อยไปมาก")
                last = tr["max_people"]
                positive(w + ".tier.sqm", tr["sqm"])
            if tiers and tiers[-1]["max_people"] < 100000:
                err(f"{w}: tier สุดท้ายต้องครอบคลุมจำนวนคนทุกค่า")

    # ---- equipment ----
    cat_ids = unique_ids(equip["categories"], "equipment.categories")
    item_ids = unique_ids(equip["items"], "equipment.items")
    for it in equip["items"]:
        w = f"equipment[{it.get('id')}]"
        check_text(w + ".name_th", it.get("name_th"))
        check_text(w + ".unit", it.get("unit"))
        if it.get("category") not in cat_ids:
            err(f"{w}: category '{it.get('category')}' ไม่มีอยู่จริง")
        if it.get("tier_min") not in TIERS:
            err(f"{w}: tier_min ไม่ถูกต้อง")
        if not isinstance(it.get("price_thb"), (int, float)) or it["price_thb"] < 0:
            err(f"{w}: price_thb ต้องเป็นตัวเลข >= 0")
        for lid in it.get("requires_layouts", []):
            if lid not in layout_ids:
                err(f"{w}: requires_layouts อ้างถึง '{lid}' ที่ไม่มี")
        for cid in it.get("requires_components", []):
            if cid not in comp_ids:
                err(f"{w}: requires_components อ้างถึง '{cid}' ที่ไม่มี")
        r = it.get("rule", {})
        t = r.get("type")
        if t not in RULE_TYPES:
            err(f"{w}: rule.type ไม่รู้จัก '{t}'")
        elif t == "fixed":
            positive(w + ".qty", r.get("qty"), True)
        elif t == "per_n_people":
            positive(w + ".n", r.get("n"), True)
        elif t == "per_total_area":
            positive(w + ".sqm_per_unit", r.get("sqm_per_unit"))
        elif t == "per_component_area":
            if r.get("component") not in comp_ids:
                err(f"{w}: rule.component '{r.get('component')}' ไม่มี")
            positive(w + ".sqm_per_unit", r.get("sqm_per_unit"))
            if r.get("component") not in it.get("requires_components", []):
                err(f"{w}: ใช้ per_component_area ต้องอยู่ใน requires_components ด้วย")
        elif t == "per_layout_unit" and not it.get("requires_layouts"):
            err(f"{w}: per_layout_unit ต้องระบุ requires_layouts")
    for cid in cat_ids:
        if not any(i["category"] == cid for i in equip["items"]):
            warnings.append(f"หมวด '{cid}' ไม่มีอุปกรณ์เลย")

    # ---- event types ----
    tier_ids = unique_ids(events["budget_tiers"], "budget_tiers")
    if tier_ids != set(TIERS):
        err(f"budget_tiers ต้องมี {TIERS} (ได้ {sorted(tier_ids)})")
    for t in events["budget_tiers"]:
        if t.get("layout_density") not in DENSITIES:
            err(f"budget_tier[{t.get('id')}]: layout_density ไม่ถูกต้อง")
    ev_ids = unique_ids(events["event_types"], "event_types")
    for e in events["event_types"]:
        w = f"event_type[{e.get('id')}]"
        check_text(w + ".name_th", e.get("name_th"))
        if e.get("default_layout") not in e.get("allowed_layouts", []):
            err(f"{w}: default_layout ต้องอยู่ใน allowed_layouts")
        for lid in e.get("allowed_layouts", []):
            if lid not in layout_ids:
                err(f"{w}: layout '{lid}' ไม่มี")
        for cid in e.get("default_components", []) + e.get("optional_components", []):
            if cid not in comp_ids:
                err(f"{w}: component '{cid}' ไม่มี")
        both = set(e.get("default_components", [])) & set(e.get("optional_components", []))
        if both:
            err(f"{w}: component อยู่ทั้ง default และ optional: {sorted(both)}")
        if not (0 < e.get("min_people", 0) < e.get("max_people", 0)):
            err(f"{w}: min_people/max_people ไม่ถูกต้อง")
    for l in layouts["layouts"]:
        for ev in l.get("best_for", []):
            if ev not in ev_ids:
                err(f"layouts[{l['id']}].best_for อ้างถึง event '{ev}' ที่ไม่มี")

    # ---- prompts ----
    prompts = load("prompts.json")
    if prompts:
        for k in ("extract_system", "advise_system"):
            if not isinstance(prompts.get(k), str) or len(prompts[k]) < 50:
                err(f"prompts.{k}: ต้องเป็นข้อความ prompt")
        for ph in ("{EVENT_TYPES}", "{LAYOUTS}", "{COMPONENTS}"):
            if ph not in prompts.get("extract_system", ""):
                err(f"prompts.extract_system: ขาด placeholder {ph}")
        for n, ex in enumerate(prompts.get("extract_examples", [])):
            o = ex.get("output", {})
            w = f"prompts.extract_examples[{n}]"
            if o.get("event_type") is not None and o["event_type"] not in ev_ids:
                err(f"{w}: event_type '{o['event_type']}' ไม่มี")
            if o.get("layout") is not None and o["layout"] not in layout_ids:
                err(f"{w}: layout '{o['layout']}' ไม่มี")
            if o.get("tier") is not None and o["tier"] not in TIERS:
                err(f"{w}: tier '{o['tier']}' ไม่ถูกต้อง")
            for cid in o.get("components", []):
                if cid not in comp_ids:
                    err(f"{w}: component '{cid}' ไม่มี")

    report(len(layout_ids), len(comp_ids), len(item_ids), len(ev_ids))


def report(*counts):
    for w in warnings:
        print(f"[คำเตือน] {w}")
    if errors:
        print(f"\nพบข้อผิดพลาด {len(errors)} รายการ:")
        for e in errors:
            print(f"  [ผิดพลาด] {e}")
        sys.exit(1)
    if counts:
        l, c, i, e = counts
        print(f"ผ่านทั้งหมด: layouts={l}, components={c}, equipment={i}, event_types={e}")
    sys.exit(0)


if __name__ == "__main__":
    main()
