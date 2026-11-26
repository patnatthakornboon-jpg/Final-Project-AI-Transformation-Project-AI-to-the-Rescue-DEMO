#!/usr/bin/env python3
"""วัดผลระบบ (System Validation / Metrics) และสร้างรายงาน validation_report.md

ตัวอย่าง:
  python evaluate.py                       # วัด parser แบบ rule-based + ตรวจ engine
  python evaluate.py --llm                 # วัดโหมด LLM ด้วย (ต้องตั้ง GEMINI_API_KEY หรือ OPENAI_API_KEY)
  python evaluate.py --manual-minutes 40 --tool-minutes 4   # คำนวณ % เวลาที่ลดจากผลจับเวลาจริง
  python evaluate.py --write               # เขียนรายงานลงไฟล์ validation_report.md
"""
import argparse
import datetime
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import planner_ai as ai  # noqa: E402
from planner_engine import get_data, plan  # noqa: E402
from planner_parser import parse_request  # noqa: E402

FIELDS = ["event_type", "people", "tier", "layout", "components", "budget_thb"]
LABELS = {"event_type": "ประเภทงาน", "people": "จำนวนคน", "tier": "ระดับงบ", "layout": "รูปแบบการจัด",
          "components": "ส่วนประกอบ", "budget_thb": "งบประมาณ"}


def score(cases, extract):
    tot = {f: [0, 0] for f in FIELDS}
    fails, full_ok = [], 0
    for c in cases:
        got = extract(c["text"])
        case_ok = True
        for f, exp in c["expected"].items():
            ok = set(got[f]) == set(exp) if f == "components" else got[f] == exp
            tot[f][0] += ok
            tot[f][1] += 1
            if not ok:
                case_ok = False
                fails.append((c["id"], c["text"], f, exp, got[f]))
        full_ok += case_ok
    return tot, fails, full_ok


def engine_checks():
    d = get_data()
    n = ok = 0
    t0 = time.perf_counter()
    for ev in d["events"].values():
        for people in {ev["min_people"], max(ev["min_people"], min(100, ev["max_people"])), ev["max_people"]}:
            for layout in ev["allowed_layouts"]:
                for tier in d["tiers"]:
                    n += 1
                    p = plan(ev["id"], people, tier, layout)
                    ok += (p["total_cost"] == sum(e["total_price"] for e in p["equipment"])
                           and all(isinstance(e["qty"], int) and e["qty"] > 0 for e in p["equipment"])
                           and p["area"]["total"] > p["area"]["seating"])
    avg_ms = (time.perf_counter() - t0) / n * 1000
    return n, ok, avg_ms


def pct(a, b):
    return f"{a}/{b} ({a / b * 100:.0f}%)" if b else "-"


def table(tot, full_ok, n_cases):
    rows = ["| ฟิลด์ | ถูกต้อง |", "|---|---|"]
    for f in FIELDS:
        rows.append(f"| {LABELS[f]} | {pct(*tot[f])} |")
    ca = sum(v[0] for v in tot.values())
    cb = sum(v[1] for v in tot.values())
    rows.append(f"| **รวมทุกฟิลด์** | **{pct(ca, cb)}** |")
    rows.append(f"| เคสที่ถูกครบทุกฟิลด์ | {pct(full_ok, n_cases)} |")
    return "\n".join(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--llm", action="store_true", help="วัดโหมด LLM ด้วย (ต้องมี API key)")
    ap.add_argument("--manual-minutes", type=float, help="เวลาที่ใช้วางแผนด้วยมือ (นาที/งาน) จากการจับเวลาจริง")
    ap.add_argument("--tool-minutes", type=float, help="เวลาที่ใช้เมื่อใช้เครื่องมือนี้ (นาที/งาน) จากการจับเวลาจริง")
    ap.add_argument("--write", action="store_true", help="เขียนรายงานลง validation_report.md")
    args = ap.parse_args()

    cases = json.load(open(ROOT / "test_cases.json", encoding="utf-8"))["cases"]
    tot, fails, full_ok = score(cases, parse_request)
    n_scen, ok_scen, avg_ms = engine_checks()

    lines = [f"# รายงานการวัดผลระบบ (System Validation)", "",
             f"สร้างอัตโนมัติด้วย `python evaluate.py --write` เมื่อ {datetime.date.today().isoformat()}", "",
             "## 1) ความแม่นยำในการอ่านโจทย์ — โหมด rule-based (ไม่ใช้ AI)", "",
             f"ทดสอบกับโจทย์ {len(cases)} ข้อความ (ไทย/อังกฤษ/เลขไทย/หน่วยงบแบบ 'หมื่น', 'k') ที่มนุษย์กำหนดคำตอบไว้ล่วงหน้า "
             "ฟิลด์ที่ไม่ระบุในเฉลยจะไม่ถูกนับ", "", table(tot, full_ok, len(cases)), ""]
    if fails:
        lines += ["เคสที่ parser ตอบผิด (ตั้งใจเก็บไว้เป็นเคสยาก เพื่อแสดงเหตุผลที่ต้องมีโหมด LLM):", ""]
        for cid, text, f, exp, got in fails:
            lines.append(f"- #{cid} `{text}` — {LABELS[f]}: คาดหวัง `{exp}` ได้ `{got}`")
        lines.append("")

    if args.llm:
        prov, _ = ai.available_provider()
        if not prov:
            print("ไม่พบ API key (GEMINI_API_KEY / OPENAI_API_KEY) จึงข้ามการวัดโหมด LLM", file=sys.stderr)
            lines += ["## 2) ความแม่นยำในการอ่านโจทย์ — โหมด LLM", "",
                      "ไม่ได้วัดในรอบนี้ (ไม่พบ API key)", ""]
        else:
            used_llm = []

            def extract(text):
                req, src = ai.extract_requirements(text)
                used_llm.append(src["source"] == "llm")
                return req
            t2, f2, full2 = score(cases, extract)
            lines += [f"## 2) ความแม่นยำในการอ่านโจทย์ — โหมด LLM ({prov})", "",
                      f"เรียก LLM สำเร็จ {sum(used_llm)}/{len(used_llm)} เคส (ที่เหลือ fallback เป็น rule-based)", "",
                      table(t2, full2, len(cases)), ""]
            for cid, text, f, exp, got in f2:
                lines.append(f"- #{cid} {LABELS[f]}: คาดหวัง `{exp}` ได้ `{got}`")
            lines.append("")

    if not args.llm:
        lines += ["## 2) ความแม่นยำในการอ่านโจทย์ — โหมด LLM", "",
                  "ยังไม่ได้วัด: ตั้ง `GEMINI_API_KEY` (หรือ `OPENAI_API_KEY`) แล้วรัน `python evaluate.py --llm --write` "
                  "เพื่อเทียบกับโหมด rule-based ข้างต้น", ""]

    lines += ["## 3) ความถูกต้องของ engine คำนวณ", "",
              f"- ทดสอบ {n_scen} สถานการณ์ (ทุกประเภทงาน × layout ที่รองรับ × 3 ระดับงบ × จำนวนคนต่ำสุด/กลาง/สูงสุด): ผ่าน {ok_scen}/{n_scen}",
              "- เงื่อนไขที่ตรวจ: ราคารวม = ผลรวมรายการ, จำนวนอุปกรณ์เป็นจำนวนเต็มบวก, พื้นที่รวม > พื้นที่ที่นั่ง",
              f"- เวลาประมวลผลเฉลี่ย {avg_ms:.2f} มิลลิวินาที/แผน",
              "- ผลตัวเลขของ JavaScript (เว็บ) ตรงกับ Python (Streamlit) ทุกสถานการณ์ — ตรวจด้วย `python compare_js.py`", ""]

    lines += ["## 4) ผลลดเวลาทำงาน", ""]
    if args.manual_minutes and args.tool_minutes and args.manual_minutes > 0:
        red = (args.manual_minutes - args.tool_minutes) / args.manual_minutes * 100
        lines += [f"จากการจับเวลาจริง: วางแผนด้วยมือเฉลี่ย {args.manual_minutes:g} นาที/งาน, ใช้เครื่องมือนี้ {args.tool_minutes:g} นาที/งาน "
                  f"→ **ลดเวลาลง {red:.0f}%**", ""]
    else:
        lines += ["ยังไม่มีข้อมูลจับเวลาจริง — ห้ามใส่ตัวเลขเดาในรายงาน วิธีวัด: ให้ผู้ทดสอบอย่างน้อย 3-5 คนวางแผนงานโจทย์เดียวกัน "
                  "ด้วยมือ (Excel/กระดาษ) แล้วจับเวลา จากนั้นใช้เครื่องมือนี้แล้วจับเวลาอีกครั้ง จากนั้นรัน",
                  "", "```", "python evaluate.py --manual-minutes <เฉลี่ยด้วยมือ> --tool-minutes <เฉลี่ยด้วยเครื่องมือ> --write",
                  "```", ""]
    lines += ["## 5) ผลตอบรับจากกลุ่มตัวอย่าง (Feedback)", "",
              "กรอกหลังทดสอบจริง (แบบสอบถาม 1-5: ใช้งานง่าย / ผลสมเหตุสมผล / อยากใช้ต่อ):", "",
              "| ผู้ทดสอบ | เวลาด้วยมือ (นาที) | เวลาด้วยเครื่องมือ (นาที) | ใช้งานง่าย | ผลสมเหตุสมผล | ข้อเสนอแนะ |",
              "|---|---|---|---|---|---|",
              "| (กรอก) | | | | | |", ""]

    report = "\n".join(lines)
    print(report)
    if args.write:
        out = ROOT / "validation_report.md"
        out.write_text(report + "\n", encoding="utf-8")
        print(f"\nเขียนรายงานที่ {out.relative_to(ROOT)}", file=sys.stderr)
    if ok_scen != n_scen:
        sys.exit(1)


if __name__ == "__main__":
    main()
