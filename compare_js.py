#!/usr/bin/env python3
"""ตรวจว่า engine JavaScript (หน้าเว็บ) ให้ผลตรงกับ Python (Streamlit) ในทุกสถานการณ์

รัน:  python compare_js.py     (ต้องมี Node.js)
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from planner_engine import get_data, plan  # noqa: E402
from planner_floorplan import layout_zones, scene  # noqa: E402
from planner_parser import parse_request  # noqa: E402


def scenarios():
    d = get_data()
    out = []
    for ev in d["events"].values():
        mid = min(max(100, ev["min_people"]), ev["max_people"])
        for people in sorted({ev["min_people"], mid, ev["max_people"]}):
            for layout in ev["allowed_layouts"]:
                for tier in ("basic", "standard", "premium"):
                    for comps in (None, list(d["components"])):
                        out.append({"event_type": ev["id"], "people": people, "tier": tier,
                                    "layout": layout, "components": comps,
                                    "budget_thb": 100000 if tier == "standard" else None})
    # กวาดจำนวนคนทั้งช่วง (จับบั๊กปัดเศษ/ขอบเขต tier ที่ 3 ค่าไม่เจอ)
    for ev in d["events"].values():
        step = max(1, (ev["max_people"] - ev["min_people"]) // 40)
        pts = set(range(ev["min_people"], ev["max_people"] + 1, step))
        pts |= {49, 50, 51, 99, 100, 101, 149, 150, 151, 299, 300, 301}
        for people in sorted(x for x in pts if ev["min_people"] <= x <= ev["max_people"]):
            for tier in ("basic", "premium"):
                out.append({"event_type": ev["id"], "people": people, "tier": tier,
                            "layout": ev["default_layout"], "components": None, "budget_thb": None})
    # เคสที่ต้อง error เหมือนกัน
    out.append({"event_type": "seminar", "people": 5, "tier": "basic", "layout": None, "components": None, "budget_thb": None})
    out.append({"event_type": "exhibition", "people": 100, "tier": "basic", "layout": "theater", "components": None, "budget_thb": None})
    return out


def generated_texts(n=1500, seed=7):
    """สุ่มผสมชิ้นส่วนประโยค (ไทย/อังกฤษ/เลขไทย/หน่วยงบ/ข้อความแปลก) เพื่อเทียบ parser สองภาษา"""
    import random
    rnd = random.Random(seed)
    kinds = ["งานสัมมนา", "seminar", "แต่งงาน", "wedding", "เปิดตัวสินค้า", "launch", "นิทรรศการ", "workshop",
             "อบรม", "networking party", "ประชุม", "conference", "งานเลี้ยง", "meetup", "", "<b>x</b>"]
    ppl = ["100 คน", "๒๕๐ คน", "1,200 ท่าน", "for 80 people", "50 guests", "30 pax", "0 คน", "999999 คน", "", "3 ห้อง"]
    bud = ["งบ 5 หมื่นบาท", "budget 40k", "budget 2m", "งบ 1.5 แสน", "30000 บาท", "฿500,000", "budget 50 more",
           "40 kids budget 20 k", "งบ 2 ล้าน", "งบประมาณ 12,500", "", "งบ ๓ พัน"]
    ext = ["มีเวที", "stage", "ซุ้มอาหาร", "buffet", "ลงทะเบียน", "AV booth", "booth", "บูธ", "photo corner", "VIP lounge",
           "ฟลอร์เต้น", "dance floor", "โต๊ะจีน", "cocktail", "u-shape", "ห้องเรียน", "พรีเมียม", "premium", "ประหยัด",
           "standard", "theater", "คาบาเรต์", ""]
    out = []
    for _ in range(n):
        parts = [rnd.choice(kinds), rnd.choice(ppl), rnd.choice(bud)] + [rnd.choice(ext) for _ in range(rnd.randint(0, 3))]
        rnd.shuffle(parts)
        out.append(" ".join(x for x in parts if x))
    return out


def main():
    texts = [c["text"] for c in json.load(open(ROOT / "test_cases.json", encoding="utf-8"))["cases"]]
    texts += generated_texts()
    scs = scenarios()
    res = subprocess.run(["node", str(ROOT / "compare_js.js")],
                         input=json.dumps({"texts": texts, "scenarios": scs}), capture_output=True,
                         text=True, encoding="utf-8")
    if res.returncode != 0:
        print(res.stderr)
        sys.exit(1)
    js = json.loads(res.stdout)
    bad = []

    for t, jp in zip(texts, js["parsed"]):
        pp = parse_request(t)
        if {**pp, "components": sorted(pp["components"])} != {**jp, "components": sorted(jp["components"])}:
            bad.append(f"parser ต่างกัน: {t!r}\n   py={pp}\n   js={jp}")

    for s, jr in zip(scs, js["plans"]):
        tag = f"{s['event_type']}/{s['layout']}/{s['tier']}/{s['people']}/{'all' if s['components'] else 'def'}"
        try:
            p = plan(**s)
        except ValueError:
            if jr["ok"]:
                bad.append(f"{tag}: Python error แต่ JS ไม่ error")
            continue
        if not jr["ok"]:
            bad.append(f"{tag}: JS error ({jr['error']}) แต่ Python ไม่ error")
            continue
        py_eq = [[e["id"], e["qty"]] for e in p["equipment"]]
        if py_eq != jr["equipment"]:
            bad.append(f"{tag}: รายการ/จำนวนอุปกรณ์ต่างกัน")
        if p["total_cost"] != jr["total_cost"]:
            bad.append(f"{tag}: ราคารวมต่างกัน py={p['total_cost']} js={jr['total_cost']}")
        if abs(p["area"]["total"] - jr["total_area"]) > 0.051:
            bad.append(f"{tag}: พื้นที่รวมต่างกัน py={p['area']['total']} js={jr['total_area']}")
        if [[o["total_cost"], o["total_area"]] for o in p["tier_options"]] != jr["tier_options"]:
            bad.append(f"{tag}: ตัวเลือกระดับงบต่างกัน")
        if p["budget"] != jr["budget"]:
            bad.append(f"{tag}: ผลเทียบงบต่างกัน")
        if p["safety"] != jr["safety"]:
            bad.append(f"{tag}: ข้อมูลความปลอดภัยต่างกัน")
        sub = sum(z["sqm"] for z in p["area"]["zones"])
        _, _, rects = layout_zones(p["area"]["zones"], p["area"]["total"], sub)
        if len(rects) != len(jr["rects"]) or any(
                a["id"] != b[0] or any(abs(a[k] - b[i + 1]) > 1e-6 for i, k in enumerate("xywh"))
                for a, b in zip(rects, jr["rects"])):
            bad.append(f"{tag}: ผังพื้นที่ต่างกัน")
        _, _, _, boxes = scene(p)
        py_boxes = [[b["id"], b["x"], b["y"], b["w"], b["h"], b["label"], b["fs"], b["lines"]] for b in boxes]
        if len(py_boxes) != len(jr["boxes"]) or any(
                a[0] != b[0] or a[5] != b[5] or a[6] != b[6] or a[7] != b[7] or any(abs(a[i] - b[i]) > 1e-6 for i in range(1, 5))
                for a, b in zip(py_boxes, jr["boxes"])):
            bad.append(f"{tag}: ป้ายชื่อ/ขนาดตัวอักษรในผังต่างกัน")

    n = len(scs)
    if bad:
        print(f"พบความไม่ตรงกัน {len(bad)} จุด (จาก {n} สถานการณ์ + {len(texts)} ข้อความ):")
        for b in bad[:30]:
            print("  -", b)
        sys.exit(1)
    print(f"JS ตรงกับ Python ทุกจุด: {n} สถานการณ์ + {len(texts)} ข้อความ")


if __name__ == "__main__":
    main()
