"""Unit tests: รัน  python -m unittest discover -v   (จากโฟลเดอร์เดียวกับไฟล์นี้)"""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import planner_ai as ai  # noqa: E402
from planner_engine import get_data, plan  # noqa: E402
from planner_floorplan import floorplan_svg  # noqa: E402
from planner_parser import parse_request  # noqa: E402

D = get_data()


def qty(p, item_id):
    return next((e["qty"] for e in p["equipment"] if e["id"] == item_id), None)


class EngineTests(unittest.TestCase):
    def test_known_example_seminar_100(self):
        # ที่นั่ง 100 + เวที 24 + บุฟเฟต์ 24 + ลงทะเบียน 8 + AV 4 = 160, x1.2 ทางสัญจร = 192
        p = plan("seminar", 100, "standard")
        self.assertEqual(p["area"]["total"], 192.0)
        self.assertEqual(p["area"]["recommended_min_venue"], 192)
        self.assertEqual(p["safety"]["toilets"], 3)

    def test_float_rounding_does_not_overcount(self):
        # 100 คน x spare 5% ต้องได้ 105 ตัว ไม่ใช่ 106 (บั๊กทศนิยมที่เคยเจอ)
        p = plan("seminar", 100, "standard")
        self.assertEqual(qty(p, "chair"), 105)
        self.assertEqual(qty(p, "name_badges"), 110)

    def test_all_combinations_run_and_are_sane(self):
        for ev in D["events"].values():
            for people in {ev["min_people"], ev["max_people"]}:
                for layout in ev["allowed_layouts"]:
                    for tier in D["tiers"]:
                        p = plan(ev["id"], people, tier, layout)
                        self.assertGreater(p["area"]["total"], p["area"]["seating"])
                        self.assertGreater(p["total_cost"], 0)
                        for e in p["equipment"]:
                            self.assertIsInstance(e["qty"], int)
                            self.assertGreater(e["qty"], 0, e["id"])
                        self.assertEqual(sum(e["total_price"] for e in p["equipment"]), p["total_cost"])
                        self.assertEqual(sum(g["subtotal"] for g in p["equipment_groups"]), p["total_cost"])

    def test_more_people_never_means_less_area_or_cost(self):
        for ev in D["events"].values():
            last_a = last_c = 0
            for n in range(ev["min_people"], ev["max_people"] + 1, max(1, ev["max_people"] // 40)):
                p = plan(ev["id"], n, "standard")
                self.assertGreaterEqual(p["area"]["total"], last_a)
                self.assertGreaterEqual(p["total_cost"], last_c)
                last_a, last_c = p["area"]["total"], p["total_cost"]

    def test_higher_tier_costs_more_and_needs_more_space(self):
        p = plan("wedding_banquet", 200, "basic")
        o = {x["tier"]: x for x in p["tier_options"]}
        self.assertLess(o["basic"]["total_cost"], o["standard"]["total_cost"])
        self.assertLess(o["standard"]["total_cost"], o["premium"]["total_cost"])
        self.assertLess(o["basic"]["total_area"], o["premium"]["total_area"])

    def test_tier_options_match_direct_calls(self):
        p = plan("conference", 250, "standard")
        for o in p["tier_options"]:
            self.assertEqual(o["total_cost"], plan("conference", 250, o["tier"])["total_cost"])

    def test_budget_logic(self):
        p = plan("seminar", 100, "premium", budget_thb=50000)
        self.assertFalse(p["budget"]["within_budget"])
        self.assertEqual(p["budget"]["recommended_tier"], "basic")
        p = plan("seminar", 100, "basic", budget_thb=10_000_000)
        self.assertTrue(p["budget"]["within_budget"])
        self.assertEqual(p["budget"]["recommended_tier"], "premium")
        p = plan("seminar", 100, "basic", budget_thb=1000)
        self.assertIsNone(p["budget"]["recommended_tier"])
        self.assertIsNone(plan("seminar", 100)["budget"])

    def test_component_choices_change_equipment(self):
        with_stage = plan("seminar", 100, "standard", components=["stage"])
        without = plan("seminar", 100, "standard", components=["registration"])
        self.assertIsNotNone(qty(with_stage, "backdrop"))
        self.assertIsNone(qty(without, "backdrop"))

    def test_layout_specific_items(self):
        self.assertIsNotNone(qty(plan("wedding_banquet", 100, "standard"), "round_table"))
        self.assertEqual(qty(plan("wedding_banquet", 100, "standard"), "round_table"), 10)
        self.assertIsNone(qty(plan("networking", 100, "standard"), "chair"))

    def test_invalid_inputs_raise_valueerror(self):
        bad = [
            dict(event_type="nope", people=10), dict(event_type="seminar", people=5),
            dict(event_type="seminar", people=5000), dict(event_type="seminar", people=10.5),
            dict(event_type="seminar", people=True), dict(event_type="seminar", people=50, tier="gold"),
            dict(event_type="exhibition", people=100, layout="theater"),
            dict(event_type="seminar", people=50, components=["nope"]),
            dict(event_type="seminar", people=50, budget_thb=0),
            dict(event_type="seminar", people=50, budget_thb=-5),
        ]
        for kw in bad:
            with self.assertRaises(ValueError, msg=str(kw)):
                plan(**kw)

    def test_floorplan_svg_is_wellformed(self):
        import xml.dom.minidom as md
        for ev in D["events"]:
            p = plan(ev, D["events"][ev]["min_people"] + 20 if ev != "exhibition" else 100, "standard",
                     components=list(D["components"]))
            md.parseString(floorplan_svg(p))  # ต้อง parse เป็น XML ได้


class ParserAndAiTests(unittest.TestCase):
    def test_parser_basics(self):
        r = parse_request("งานสัมมนา 100 คน มีเวทีและซุ้มอาหาร งบ 5 หมื่นบาท")
        self.assertEqual((r["event_type"], r["people"], r["budget_thb"]), ("seminar", 100, 50000))
        self.assertEqual(set(r["components"]), {"stage", "buffet"})
        self.assertEqual(parse_request("")["event_type"], None)
        self.assertEqual(parse_request(None)["people"], None)

    def test_av_booth_is_not_exhibition_booths(self):
        r = parse_request("event with an AV booth")
        self.assertEqual(r["components"], ["av_booth"])

    def test_sanitize_drops_hallucinated_values(self):
        raw = {"event_type": "rave", "people": "100", "tier": "gold", "layout": "circle",
               "components": ["stage", "laser", "stage"], "budget_thb": -5}
        s = ai.sanitize_requirements(raw)
        self.assertEqual(s, {"event_type": None, "people": None, "tier": None, "layout": None,
                             "components": ["stage"], "budget_thb": None})
        self.assertEqual(ai.sanitize_requirements("not a dict")["components"], [])

    def test_llm_path_uses_sanitized_json(self):
        fake = lambda *a, **k: '```json\n{"event_type":"workshop","people":30,"components":["stage","x"]}\n```'
        req, src = ai.extract_requirements("อะไรก็ได้", api_key="fake-key", provider="gemini", llm=fake)
        self.assertEqual(src["source"], "llm")
        self.assertEqual((req["event_type"], req["people"], req["components"]), ("workshop", 30, ["stage"]))

    def test_llm_failure_falls_back_to_rules(self):
        def boom(*a, **k):
            raise TimeoutError("network down")
        req, src = ai.extract_requirements("สัมมนา 50 คน", api_key="fake-key", provider="gemini", llm=boom)
        self.assertEqual((src["source"], req["people"]), ("rules", 50))
        self.assertIn("TimeoutError", src["error"])
        text, src = ai.advise(plan("seminar", 50), api_key="fake-key", provider="gemini", llm=boom)
        self.assertEqual(src["source"], "rules")
        self.assertTrue(text.startswith("- "))

    def test_llm_garbage_reply_falls_back(self):
        req, src = ai.extract_requirements("สัมมนา 50 คน", api_key="k", provider="gemini",
                                           llm=lambda *a, **k: "ขออภัย ไม่เข้าใจ")
        self.assertEqual(src["source"], "rules")

    def test_prompt_contains_all_ids(self):
        system, shots = ai.build_extract_prompt()
        for i in list(D["events"]) + list(D["layouts"]) + list(D["components"]):
            self.assertIn(i, system)
        self.assertNotIn("{EVENT_TYPES}", system)
        self.assertIn("Input:", shots)

    def test_llm_summary_is_json_serializable_and_compact(self):
        s = json.dumps(ai.plan_summary_for_llm(plan("seminar", 100)), ensure_ascii=False)
        self.assertLess(len(s), 3000)


class RegressionTests(unittest.TestCase):
    """บั๊กที่เคยเจอจริงระหว่างตรวจสอบ — ห้ามกลับมาอีก"""

    def test_budget_unit_letters_must_not_be_multipliers(self):
        # "50 more" เคยถูกอ่านเป็น 50 ล้านบาท (m = million), "40 kids" เป็น 40,000 (k = thousand)
        self.assertEqual(parse_request("seminar budget 50 more people")["budget_thb"], 50)
        self.assertEqual(parse_request("budget 40 kids workshop")["budget_thb"], 40)
        self.assertEqual(parse_request("seminar 100 people budget 40k")["budget_thb"], 40000)
        self.assertEqual(parse_request("budget 2m")["budget_thb"], 2_000_000)

    def test_u_shape_does_not_need_one_table_per_person(self):
        p = plan("workshop", 45, "standard", "u_shape")
        self.assertLess(qty(p, "long_table"), 45)
        self.assertEqual(qty(p, "long_table"), 23)

    def test_cocktail_tables_are_reasonable(self):
        self.assertEqual(qty(plan("networking", 100, "standard"), "cocktail_table"), 13)

    def test_floorplan_labels_every_zone_in_typical_plans(self):
        from planner_floorplan import scene
        wedding = D["events"]["wedding_banquet"]["default_components"] + ["av_booth", "lounge"]
        for ev, n, comps in [("seminar", 100, None), ("wedding_banquet", 250, wedding),
                             ("workshop", 30, None), ("networking", 80, None)]:
            boxes = scene(plan(ev, n, "standard", components=comps))[3]
            for b in boxes:
                self.assertTrue(b["label"], f"{ev}: โซน {b['id']} ไม่มีป้าย (w={b['w']:.0f}, h={b['h']:.0f})")

    def test_floorplan_svg_is_standalone_and_sized(self):
        svg = floorplan_svg(plan("seminar", 100), fixed_size=True)
        self.assertIn('fill="#ffffff"', svg)          # อ่านได้ทั้งธีมมืด/สว่าง
        self.assertIn('width="720"', svg)             # st.image ต้องมีขนาดตายตัว ไม่งั้นเล็กจิ๋ว
        self.assertIn('width="100%"', floorplan_svg(plan("seminar", 100)))


class _Resp:
    """response ปลอมของ urllib.request.urlopen"""
    def __init__(self, obj):
        self._b = json.dumps(obj).encode("utf-8")

    def read(self):
        return self._b

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class AiErrorReportingTests(unittest.TestCase):
    """เมื่อเรียก AI ล้มเหลว ต้องเห็นเหตุผลจริงจาก Google (เคยเห็นแค่ 'HTTP Error 400' จนวินิจฉัยไม่ได้)"""
    KEY = "SECRETKEY123"

    def setUp(self):
        ai._WORKING.clear()

    def _fake_google(self, ok_models, calls):
        """จำลอง Google: generateContent สำเร็จเฉพาะโมเดลใน ok_models ที่เหลือตอบ 404 + รายการโมเดลของบัญชี"""
        names = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.4-flash", "gemini-3-flash-preview"]
        listing = {"models": [{"name": f"models/{n}", "supportedGenerationMethods": ["generateContent"]} for n in names]}

        def fake(req, timeout=None):
            url = req.full_url
            calls.append(url)
            if "generateContent" in url:
                model = url.split("/models/")[1].split(":")[0]
                if model in ok_models:
                    return _Resp({"candidates": [{"content": {"parts": [{"text": "OK"}]}}]})
                raise self._http_error(404, {"error": {"code": 404, "status": "NOT_FOUND", "message": f"models/{model} is not found"}})
            return _Resp(listing)
        return fake

    def test_auto_model_fallback_and_cache(self):
        from unittest import mock
        calls = []
        with mock.patch("planner_ai.urllib.request.urlopen", side_effect=self._fake_google({"gemini-3.6-flash"}, calls)):
            self.assertEqual(ai.call_llm("s", "u", "gemini", self.KEY), "OK")
            n_first = len(calls)
            self.assertEqual(ai.call_llm("s", "u", "gemini", self.KEY), "OK")
        self.assertIn("gemini-3.8-flash:generateContent", calls[0])
        self.assertTrue(any("gemini-3.6-flash:generateContent" in c for c in calls))
        self.assertEqual(len(calls) - n_first, 1)  # ครั้งที่สองใช้โมเดลที่จำไว้ตรง ๆ ไม่ลองซ้ำ
        self.assertIn("gemini-3.6-flash:generateContent", calls[-1])

    def test_explicit_model_is_never_replaced(self):
        from unittest import mock
        calls = []
        with mock.patch("planner_ai.urllib.request.urlopen", side_effect=self._fake_google({"gemini-3.6-flash"}, calls)):
            with self.assertRaises(ai.AIError) as cm:
                ai.call_llm("s", "u", "gemini", self.KEY, model="gemini-2.5-flash")
        self.assertIn("NOT_FOUND", str(cm.exception))
        self.assertEqual(len(calls), 1)

    def test_bad_key_does_not_try_other_models(self):
        from unittest import mock
        calls = []

        def fake(req, timeout=None):
            calls.append(req.full_url)
            raise self._http_error(400, {"error": {"code": 400, "status": "INVALID_ARGUMENT", "message": "API key not valid."}})
        with mock.patch("planner_ai.urllib.request.urlopen", side_effect=fake):
            with self.assertRaises(ai.AIError) as cm:
                ai.call_llm("s", "u", "gemini", self.KEY)
        self.assertIn("INVALID_ARGUMENT", str(cm.exception))
        self.assertEqual(len(calls), 1)

    def test_all_fallbacks_fail_reports_original_error(self):
        from unittest import mock
        calls = []
        with mock.patch("planner_ai.urllib.request.urlopen", side_effect=self._fake_google(set(), calls)):
            with self.assertRaises(ai.AIError) as cm:
                ai.call_llm("s", "u", "gemini", self.KEY)
        self.assertIn("gemini-3.8-flash", str(cm.exception))  # error ของโมเดลแรก ไม่ใช่ของตัวสำรอง
        self.assertEqual(sum("generateContent" in c for c in calls), 3)  # ตัวแรก + สำรองไม่เกิน 2

    def test_connection_auto_picks_available_model(self):
        from unittest import mock
        models = {"models": [{"name": f"models/{n}", "supportedGenerationMethods": ["generateContent"]}
                             for n in ("gemini-3.6-flash", "gemini-3-flash-preview")]}
        with mock.patch("planner_ai._get", return_value=models), mock.patch("planner_ai.call_llm", return_value="OK") as m:
            ok, text = ai.test_connection(self.KEY, "gemini", None)
        self.assertTrue(ok, text)
        self.assertIn("เลือก 'gemini-3.6-flash' ให้อัตโนมัติ", text)
        self.assertEqual(m.call_args.kwargs["model"], "gemini-3.6-flash")

    def _http_error(self, code, body, reason="x"):
        import io
        import urllib.error
        raw = body if isinstance(body, bytes) else json.dumps(body).encode("utf-8")
        return urllib.error.HTTPError("https://x", code, reason, {}, io.BytesIO(raw))

    def _call_with(self, side_effect):
        from unittest import mock
        with mock.patch("planner_ai.urllib.request.urlopen", side_effect=side_effect):
            return ai.call_llm("s", "u", "gemini", self.KEY)

    def test_invalid_key_reason_shown_and_key_hidden(self):
        body = {"error": {"code": 400, "status": "INVALID_ARGUMENT",
                          "message": f"API key not valid. Please pass a valid API key. ({self.KEY})"}}
        with self.assertRaises(ai.AIError) as cm:
            self._call_with(self._http_error(400, body, "Bad Request"))
        msg = str(cm.exception)
        for part in ("HTTP 400", "INVALID_ARGUMENT", "API key not valid"):
            self.assertIn(part, msg)
        self.assertNotIn(self.KEY, msg)

    def test_403_project_denied_reason_shown(self):
        body = {"error": {"code": 403, "status": "PERMISSION_DENIED",
                          "message": "Your project has been denied access. Please contact support."}}
        with self.assertRaises(ai.AIError) as cm:
            self._call_with(self._http_error(403, body, "Forbidden"))
        self.assertIn("HTTP 403 PERMISSION_DENIED Your project has been denied access", str(cm.exception))

    def test_non_json_body_still_reports_status(self):
        with self.assertRaises(ai.AIError) as cm:
            self._call_with(self._http_error(502, b"<html>bad gateway</html>", "Bad Gateway"))
        self.assertIn("HTTP 502 Bad Gateway", str(cm.exception))

    def test_network_failure_message(self):
        import urllib.error
        with self.assertRaises(ai.AIError) as cm:
            self._call_with(urllib.error.URLError("timed out"))
        self.assertIn("เชื่อมต่อไม่ได้", str(cm.exception))

    def test_fallback_keeps_reason_for_ui(self):
        from unittest import mock
        body = {"error": {"code": 400, "status": "INVALID_ARGUMENT", "message": "API key not valid."}}
        with mock.patch("planner_ai.urllib.request.urlopen", side_effect=self._http_error(400, body)):
            req, src = ai.extract_requirements("สัมมนา 50 คน", api_key=self.KEY, provider="gemini")
        self.assertEqual((src["source"], req["people"]), ("rules", 50))
        self.assertIn("INVALID_ARGUMENT", src["error"])

    def test_multi_part_reply_skips_thought_parts(self):
        from unittest import mock
        res = {"candidates": [{"content": {"parts": [{"text": "คิด", "thought": True}, {"text": "O"}, {"text": "K"}]}}]}
        with mock.patch("planner_ai.urllib.request.urlopen", return_value=_Resp(res)):
            self.assertEqual(ai.call_llm("s", "u", "gemini", self.KEY), "OK")

    def test_blocked_reply_explains_why(self):
        from unittest import mock
        with mock.patch("planner_ai.urllib.request.urlopen", return_value=_Resp({"promptFeedback": {"blockReason": "SAFETY"}})):
            with self.assertRaises(ai.AIError) as cm:
                ai.call_llm("s", "u", "gemini", self.KEY)
        self.assertIn("SAFETY", str(cm.exception))

    def test_connection_check_variants(self):
        from unittest import mock
        names = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3-flash-preview", "gemini-2.5-flash-image"]
        models = {"models": [{"name": f"models/{n}", "supportedGenerationMethods": ["generateContent"]} for n in names]
                  + [{"name": "models/text-embedding-004", "supportedGenerationMethods": ["embedContent"]}]}
        with mock.patch("planner_ai._get", return_value=models), mock.patch("planner_ai.call_llm", return_value="OK"):
            ok, text = ai.test_connection(self.KEY, "gemini", None)
            self.assertTrue(ok, text)
            ok, text = ai.test_connection(self.KEY, "gemini", "gemini-2.5-flash")
            self.assertFalse(ok)
            self.assertIn("gemini-3.8-flash, gemini-3.6-flash", text)
            self.assertNotIn("preview", text.split("ลองใช้:")[1])
            self.assertNotIn("image", text.split("ลองใช้:")[1])
        with mock.patch("planner_ai._get", side_effect=ai.AIError("HTTP 403 PERMISSION_DENIED denied")):
            ok, text = ai.test_connection(self.KEY, "gemini", None)
            self.assertFalse(ok)
            self.assertIn("PERMISSION_DENIED", text)
        self.assertEqual(ai.test_connection(None, None, None)[0], False)

    def test_javascript_ai_layer(self):
        import shutil
        import subprocess
        if not shutil.which("node"):
            self.skipTest("ไม่มี Node.js")
        r = subprocess.run(["node", str(ROOT / "test_ai_js.js")], capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)


@unittest.skipUnless(__import__("importlib").util.find_spec("streamlit"), "ไม่ได้ติดตั้ง streamlit")
class StreamlitAppTests(unittest.TestCase):
    def _app(self):
        from streamlit.testing.v1 import AppTest
        at = AppTest.from_file(str(ROOT / "app.py"), default_timeout=30)
        at.run()
        self.assertFalse(at.exception, [e.value for e in at.exception])
        return at

    def test_starts_empty_until_user_acts(self):
        at = self._app()
        self.assertEqual(at.text_area(key="intake_text").value, "")
        self.assertEqual(len(at.metric), 0)  # ยังไม่มีผลคำนวณ
        at.button[0].click().run()  # กดอ่านโจทย์ทั้งที่ยังว่าง
        self.assertEqual(len(at.metric), 0)
        self.assertTrue(any("ยังไม่ได้พิมพ์โจทย์" in w.value for w in at.warning))
        at.text_area(key="intake_text").set_value("งานสัมมนา 100 คน มีเวที")
        at.button[0].click().run()
        self.assertEqual(len(at.metric), 5)

    def test_typing_updates_form_without_button(self):
        at = self._app()
        at.text_area(key="intake_text").set_value("งานแต่งงาน 250 คน โต๊ะจีน งบ 3 แสนบาท").run()
        self.assertEqual(at.session_state.event_type, "wedding_banquet")
        self.assertEqual(at.session_state.people, 250)
        self.assertEqual(at.session_state.budget, 300000)
        self.assertEqual(len(at.metric), 5)

    def test_no_stray_objects_rendered(self):
        # เคยมี repr ของ DeltaGenerator หลุดขึ้นแถบด้านข้าง (นิพจน์ if-else บรรทัดเดียวที่ Streamlit แสดงผลเอง)
        at = self._app()
        text = " ".join(str(getattr(e, "value", "")) for e in at.main) + " ".join(
            str(getattr(e, "value", "")) for e in at.sidebar)
        self.assertNotIn("DeltaGenerator", text)

    def test_new_text_resets_tier(self):
        at = self._app()
        at.text_area(key="intake_text").set_value("งานแต่งงาน 250 คน ระดับพรีเมียม")
        at.button[0].click().run()
        self.assertEqual(at.session_state.tier, "premium")
        at.text_area(key="intake_text").set_value("งานสัมมนา 100 คน")
        at.button[0].click().run()
        self.assertEqual(at.session_state.tier, "standard")  # เคยค้างเป็น premium

    def test_out_of_range_people_is_clamped_with_notice(self):
        at = self._app()
        at.text_area(key="intake_text").set_value("workshop for 900 people")
        at.button[0].click().run()
        self.assertEqual(at.session_state.people, 200)
        self.assertTrue(any("ปรับจาก 900" in w.value for w in at.warning))


if __name__ == "__main__":
    unittest.main()
