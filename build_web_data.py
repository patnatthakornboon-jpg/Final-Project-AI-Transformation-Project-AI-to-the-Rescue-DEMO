#!/usr/bin/env python3
"""รวมไฟล์ *.json เป็น data.js (ใช้กับหน้าเว็บ GitHub Pages ที่เปิดได้แม้ไม่มีเซิร์ฟเวอร์)

รัน:  python build_web_data.py          # สร้าง/อัปเดตไฟล์
      python build_web_data.py --check  # ตรวจว่า data.js ตรงกับไฟล์ .json (ใช้ใน CI)
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FILES = ["layouts", "venue_rules", "equipment", "event_types", "prompts"]
OUT = ROOT / "data.js"


def build():
    data = {}
    for n in FILES:
        with open(ROOT / f"{n}.json", encoding="utf-8") as f:
            data[n] = json.load(f)
    body = json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True)
    return ("// สร้างอัตโนมัติจาก *.json ด้วย build_web_data.py — อย่าแก้ไฟล์นี้ด้วยมือ\n"
            f"globalThis.PLANNER_DATA = {body};\n")


if __name__ == "__main__":
    text = build()
    if "--check" in sys.argv:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
            print("data.js ไม่ตรงกับ *.json — รัน python build_web_data.py")
            sys.exit(1)
        print("data.js ตรงกับไฟล์ .json แล้ว")
    else:
        OUT.write_text(text, encoding="utf-8")
        print(f"เขียน {OUT.relative_to(ROOT)} ({len(text):,} ตัวอักษร)")
