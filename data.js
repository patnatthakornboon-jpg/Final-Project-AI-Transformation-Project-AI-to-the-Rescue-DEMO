// สร้างอัตโนมัติจาก *.json ด้วย build_web_data.py — อย่าแก้ไฟล์นี้ด้วยมือ
globalThis.PLANNER_DATA = {
 "equipment": {
  "_meta": {
   "description": "แคตตาล็อกอุปกรณ์พร้อมกฎการคำนวณจำนวน และราคาประมาณต่อวันงาน (บาท)",
   "price_note": "ราคาเป็นค่าประมาณสำหรับการวางแผน ปรับตามราคาตลาดจริงได้",
   "rule_types": [
    "fixed",
    "per_n_people",
    "per_layout_unit",
    "per_total_area",
    "per_component_area"
   ]
  },
  "categories": [
   {
    "id": "seating",
    "name_th": "เก้าอี้และโต๊ะ"
   },
   {
    "id": "stage",
    "name_th": "เวทีและฉาก"
   },
   {
    "id": "audio",
    "name_th": "ระบบเสียง"
   },
   {
    "id": "visual",
    "name_th": "ภาพและแสง"
   },
   {
    "id": "food",
    "name_th": "อาหารและเครื่องดื่ม"
   },
   {
    "id": "registration",
    "name_th": "ลงทะเบียนและป้าย"
   },
   {
    "id": "power_network",
    "name_th": "ไฟฟ้าและเครือข่าย"
   },
   {
    "id": "safety",
    "name_th": "ความปลอดภัย"
   },
   {
    "id": "decor",
    "name_th": "ตกแต่ง"
   }
  ],
  "items": [
   {
    "category": "seating",
    "id": "chair",
    "name_th": "เก้าอี้",
    "price_thb": 15,
    "requires_layouts": [
     "theater",
     "classroom",
     "banquet",
     "cabaret",
     "u_shape"
    ],
    "rule": {
     "n": 1,
     "spare_ratio": 0.05,
     "type": "per_n_people"
    },
    "tier_min": "basic",
    "unit": "ตัว"
   },
   {
    "category": "seating",
    "id": "round_table",
    "name_th": "โต๊ะกลม (พร้อมผ้าคลุม)",
    "price_thb": 250,
    "requires_layouts": [
     "banquet",
     "cabaret"
    ],
    "rule": {
     "type": "per_layout_unit"
    },
    "tier_min": "basic",
    "unit": "ตัว"
   },
   {
    "category": "seating",
    "id": "long_table",
    "name_th": "โต๊ะยาว 1.8 ม.",
    "price_thb": 120,
    "requires_layouts": [
     "classroom",
     "u_shape"
    ],
    "rule": {
     "type": "per_layout_unit"
    },
    "tier_min": "basic",
    "unit": "ตัว"
   },
   {
    "category": "seating",
    "id": "cocktail_table",
    "name_th": "โต๊ะค็อกเทลสูง",
    "price_thb": 200,
    "requires_layouts": [
     "cocktail"
    ],
    "rule": {
     "type": "per_layout_unit"
    },
    "tier_min": "basic",
    "unit": "ตัว"
   },
   {
    "category": "stage",
    "id": "stage_platform",
    "name_th": "แท่นเวที (ตาราง ม. ของพื้นเวที)",
    "price_thb": 180,
    "requires_components": [
     "stage"
    ],
    "rule": {
     "component": "stage",
     "sqm_per_unit": 1,
     "type": "per_component_area"
    },
    "tier_min": "basic",
    "unit": "ตร.ม."
   },
   {
    "category": "stage",
    "id": "backdrop",
    "name_th": "ฉากหลังเวที (Backdrop)",
    "price_thb": 6000,
    "requires_components": [
     "stage"
    ],
    "rule": {
     "qty": 1,
     "type": "fixed"
    },
    "tier_min": "basic",
    "unit": "ชุด"
   },
   {
    "category": "stage",
    "id": "podium",
    "name_th": "โพเดียมพูด",
    "price_thb": 800,
    "requires_components": [
     "stage"
    ],
    "rule": {
     "qty": 1,
     "type": "fixed"
    },
    "tier_min": "basic",
    "unit": "ตัว"
   },
   {
    "category": "stage",
    "id": "stage_skirt_carpet",
    "name_th": "พรมปูเวที/ผ้าคลุมขอบเวที",
    "price_thb": 2500,
    "requires_components": [
     "stage"
    ],
    "rule": {
     "qty": 1,
     "type": "fixed"
    },
    "tier_min": "standard",
    "unit": "ชุด"
   },
   {
    "category": "audio",
    "id": "speaker_pa",
    "name_th": "ลำโพง PA",
    "price_thb": 1500,
    "rule": {
     "min_qty": 2,
     "n": 60,
     "round_even": true,
     "type": "per_n_people"
    },
    "tier_min": "basic",
    "unit": "ตัว"
   },
   {
    "category": "audio",
    "id": "mixer",
    "name_th": "มิกเซอร์เสียง",
    "price_thb": 2000,
    "rule": {
     "qty": 1,
     "type": "fixed"
    },
    "tier_min": "basic",
    "unit": "เครื่อง"
   },
   {
    "category": "audio",
    "id": "wireless_mic",
    "name_th": "ไมค์ไร้สาย",
    "price_thb": 500,
    "rule": {
     "min_qty": 2,
     "n": 50,
     "type": "per_n_people"
    },
    "tier_min": "basic",
    "unit": "ตัว"
   },
   {
    "category": "audio",
    "id": "lapel_mic",
    "name_th": "ไมค์หนีบปกเสื้อ",
    "price_thb": 600,
    "requires_components": [
     "stage"
    ],
    "rule": {
     "qty": 2,
     "type": "fixed"
    },
    "tier_min": "standard",
    "unit": "ตัว"
   },
   {
    "category": "visual",
    "id": "led_screen_or_projector",
    "name_th": "จอ LED / โปรเจกเตอร์ + จอรับภาพ",
    "price_thb": 8000,
    "requires_components": [
     "stage"
    ],
    "rule": {
     "min_qty": 1,
     "n": 150,
     "type": "per_n_people"
    },
    "tier_min": "basic",
    "unit": "ชุด"
   },
   {
    "category": "visual",
    "id": "stage_light",
    "name_th": "ไฟส่องเวที",
    "price_thb": 1200,
    "requires_components": [
     "stage"
    ],
    "rule": {
     "component": "stage",
     "sqm_per_unit": 6,
     "type": "per_component_area"
    },
    "tier_min": "standard",
    "unit": "ชุด"
   },
   {
    "category": "visual",
    "id": "moving_head",
    "name_th": "ไฟมูฟวิ่งเฮด/เอฟเฟกต์",
    "price_thb": 2500,
    "requires_components": [
     "stage"
    ],
    "rule": {
     "qty": 4,
     "type": "fixed"
    },
    "tier_min": "premium",
    "unit": "ชุด"
   },
   {
    "category": "visual",
    "id": "camera_crew",
    "name_th": "กล้องบันทึกภาพ/ถ่ายทอดสด",
    "price_thb": 7000,
    "requires_components": [
     "av_booth"
    ],
    "rule": {
     "qty": 1,
     "type": "fixed"
    },
    "tier_min": "premium",
    "unit": "ชุด"
   },
   {
    "category": "food",
    "id": "buffet_counter",
    "name_th": "เคาน์เตอร์บุฟเฟต์พร้อมอุ่นอาหาร",
    "price_thb": 1500,
    "requires_components": [
     "buffet"
    ],
    "rule": {
     "min_qty": 1,
     "n": 50,
     "type": "per_n_people"
    },
    "tier_min": "basic",
    "unit": "ชุด"
   },
   {
    "category": "food",
    "id": "water_station",
    "name_th": "จุดน้ำดื่ม/กาแฟ",
    "price_thb": 1200,
    "rule": {
     "min_qty": 1,
     "n": 80,
     "type": "per_n_people"
    },
    "tier_min": "basic",
    "unit": "จุด"
   },
   {
    "category": "food",
    "id": "plates_cutlery",
    "name_th": "ชุดจาน ช้อนส้อม แก้ว (ต่อคน)",
    "price_thb": 25,
    "requires_components": [
     "buffet"
    ],
    "rule": {
     "n": 1,
     "spare_ratio": 0.1,
     "type": "per_n_people"
    },
    "tier_min": "basic",
    "unit": "ชุด"
   },
   {
    "category": "food",
    "id": "waste_bins",
    "name_th": "ถังขยะแยกประเภท",
    "price_thb": 150,
    "rule": {
     "min_qty": 2,
     "n": 50,
     "type": "per_n_people"
    },
    "tier_min": "basic",
    "unit": "ชุด"
   },
   {
    "category": "registration",
    "id": "reg_desk",
    "name_th": "โต๊ะลงทะเบียน",
    "price_thb": 300,
    "requires_components": [
     "registration"
    ],
    "rule": {
     "min_qty": 2,
     "n": 50,
     "type": "per_n_people"
    },
    "tier_min": "basic",
    "unit": "ตัว"
   },
   {
    "category": "registration",
    "id": "name_badges",
    "name_th": "บัตรชื่อผู้เข้างาน",
    "price_thb": 8,
    "rule": {
     "n": 1,
     "spare_ratio": 0.1,
     "type": "per_n_people"
    },
    "tier_min": "basic",
    "unit": "ใบ"
   },
   {
    "category": "registration",
    "id": "signage",
    "name_th": "ป้ายบอกทาง/ป้ายโซน",
    "price_thb": 400,
    "rule": {
     "min_qty": 3,
     "sqm_per_unit": 80,
     "type": "per_total_area"
    },
    "tier_min": "basic",
    "unit": "ป้าย"
   },
   {
    "category": "power_network",
    "id": "extension_power",
    "name_th": "ปลั๊กพ่วง/ชุดจ่ายไฟ",
    "price_thb": 150,
    "rule": {
     "min_qty": 4,
     "sqm_per_unit": 40,
     "type": "per_total_area"
    },
    "tier_min": "basic",
    "unit": "ชุด"
   },
   {
    "category": "power_network",
    "id": "wifi_ap",
    "name_th": "Wi-Fi Access Point",
    "price_thb": 1000,
    "rule": {
     "min_qty": 1,
     "n": 50,
     "type": "per_n_people"
    },
    "tier_min": "standard",
    "unit": "จุด"
   },
   {
    "category": "safety",
    "id": "fire_extinguisher",
    "name_th": "ถังดับเพลิง (สถานที่มักจัดให้)",
    "price_thb": 0,
    "rule": {
     "min_qty": 2,
     "sqm_per_unit": 150,
     "type": "per_total_area"
    },
    "tier_min": "basic",
    "unit": "ถัง"
   },
   {
    "category": "safety",
    "id": "first_aid",
    "name_th": "ชุดปฐมพยาบาล",
    "price_thb": 300,
    "rule": {
     "qty": 1,
     "type": "fixed"
    },
    "tier_min": "basic",
    "unit": "ชุด"
   },
   {
    "category": "safety",
    "id": "security_staff",
    "name_th": "เจ้าหน้าที่รักษาความปลอดภัย",
    "price_thb": 1000,
    "rule": {
     "min_qty": 2,
     "n": 100,
     "type": "per_n_people"
    },
    "tier_min": "standard",
    "unit": "คน"
   },
   {
    "category": "decor",
    "id": "photo_backdrop",
    "name_th": "ฉากถ่ายภาพ + ไฟสตูดิโอ",
    "price_thb": 4000,
    "requires_components": [
     "photo_corner"
    ],
    "rule": {
     "qty": 1,
     "type": "fixed"
    },
    "tier_min": "standard",
    "unit": "ชุด"
   },
   {
    "category": "decor",
    "id": "exhibition_booth_set",
    "name_th": "ชุดบูธ (ผนัง+โต๊ะ+ไฟ)",
    "price_thb": 3500,
    "requires_components": [
     "booths"
    ],
    "rule": {
     "component": "booths",
     "sqm_per_unit": 9,
     "type": "per_component_area"
    },
    "tier_min": "basic",
    "unit": "บูธ"
   },
   {
    "category": "decor",
    "id": "vip_sofa_set",
    "name_th": "ชุดโซฟา VIP",
    "price_thb": 3000,
    "requires_components": [
     "lounge"
    ],
    "rule": {
     "qty": 2,
     "type": "fixed"
    },
    "tier_min": "standard",
    "unit": "ชุด"
   },
   {
    "category": "decor",
    "id": "flower_decor",
    "name_th": "ดอกไม้/ของตกแต่งโต๊ะ",
    "price_thb": 700,
    "requires_layouts": [
     "banquet",
     "cabaret"
    ],
    "rule": {
     "type": "per_layout_unit"
    },
    "tier_min": "premium",
    "unit": "ชุด"
   },
   {
    "category": "decor",
    "id": "dance_floor_panel",
    "name_th": "พื้นฟลอร์เต้นรำ",
    "price_thb": 200,
    "requires_components": [
     "dance_floor"
    ],
    "rule": {
     "component": "dance_floor",
     "sqm_per_unit": 1,
     "type": "per_component_area"
    },
    "tier_min": "standard",
    "unit": "ตร.ม."
   }
  ]
 },
 "event_types": {
  "_meta": {
   "description": "Preset ของประเภทงาน: layout เริ่มต้น และส่วนประกอบ (components) ที่งานนั้นมักต้องใช้"
  },
  "budget_tiers": [
   {
    "id": "basic",
    "layout_density": "tight",
    "name_th": "ประหยัด",
    "rank": 1
   },
   {
    "id": "standard",
    "layout_density": "standard",
    "name_th": "มาตรฐาน",
    "rank": 2
   },
   {
    "id": "premium",
    "layout_density": "comfort",
    "name_th": "พรีเมียม",
    "rank": 3
   }
  ],
  "event_types": [
   {
    "allowed_layouts": [
     "theater",
     "classroom",
     "cabaret"
    ],
    "default_components": [
     "stage",
     "registration",
     "av_booth",
     "buffet"
    ],
    "default_layout": "theater",
    "id": "seminar",
    "max_people": 1000,
    "min_people": 10,
    "name_th": "งานสัมมนา",
    "optional_components": [
     "photo_corner",
     "lounge",
     "booths"
    ]
   },
   {
    "allowed_layouts": [
     "theater",
     "classroom",
     "cabaret"
    ],
    "default_components": [
     "stage",
     "registration",
     "av_booth",
     "buffet",
     "booths"
    ],
    "default_layout": "theater",
    "id": "conference",
    "max_people": 2000,
    "min_people": 30,
    "name_th": "งานประชุมวิชาการ/คอนเฟอเรนซ์",
    "optional_components": [
     "photo_corner",
     "lounge"
    ]
   },
   {
    "allowed_layouts": [
     "classroom",
     "cabaret",
     "u_shape"
    ],
    "default_components": [
     "stage",
     "registration"
    ],
    "default_layout": "classroom",
    "id": "workshop",
    "max_people": 200,
    "min_people": 10,
    "name_th": "เวิร์กชอป/อบรม",
    "optional_components": [
     "buffet",
     "av_booth"
    ]
   },
   {
    "allowed_layouts": [
     "banquet",
     "cabaret"
    ],
    "default_components": [
     "stage",
     "registration",
     "buffet",
     "photo_corner",
     "dance_floor"
    ],
    "default_layout": "banquet",
    "id": "wedding_banquet",
    "max_people": 1000,
    "min_people": 30,
    "name_th": "งานแต่งงาน/เลี้ยงโต๊ะจีน",
    "optional_components": [
     "av_booth",
     "lounge"
    ]
   },
   {
    "allowed_layouts": [
     "theater",
     "cocktail"
    ],
    "default_components": [
     "stage",
     "registration",
     "av_booth",
     "photo_corner"
    ],
    "default_layout": "theater",
    "id": "product_launch",
    "max_people": 800,
    "min_people": 30,
    "name_th": "งานเปิดตัวสินค้า",
    "optional_components": [
     "buffet",
     "lounge",
     "booths"
    ]
   },
   {
    "allowed_layouts": [
     "cocktail",
     "cabaret"
    ],
    "default_components": [
     "registration",
     "buffet",
     "photo_corner"
    ],
    "default_layout": "cocktail",
    "id": "networking",
    "max_people": 800,
    "min_people": 20,
    "name_th": "งานเน็ตเวิร์กกิ้ง/สังสรรค์",
    "optional_components": [
     "stage",
     "av_booth",
     "lounge"
    ]
   },
   {
    "allowed_layouts": [
     "cocktail"
    ],
    "default_components": [
     "registration",
     "booths",
     "stage"
    ],
    "default_layout": "cocktail",
    "id": "exhibition",
    "max_people": 3000,
    "min_people": 30,
    "name_th": "งานนิทรรศการ",
    "optional_components": [
     "buffet",
     "photo_corner",
     "lounge",
     "av_booth"
    ]
   }
  ]
 },
 "layouts": {
  "_meta": {
   "description": "รูปแบบการจัดที่นั่ง (layout) พร้อมพื้นที่ต่อคน หน่วย ตร.ม.",
   "source_note": "ค่ามาตรฐานทั่วไปในอุตสาหกรรม MICE ใช้เป็นค่าประมาณเพื่อการวางแผนเบื้องต้น"
  },
  "layouts": [
   {
    "best_for": [
     "seminar",
     "conference",
     "product_launch"
    ],
    "has_tables": false,
    "id": "theater",
    "name_en": "Theater",
    "name_th": "เธียเตอร์ (แถวเก้าอี้หันหน้าเวที)",
    "seats_per_unit": 1,
    "sqm_per_person": {
     "comfort": 1.2,
     "standard": 1.0,
     "tight": 0.8
    },
    "unit_name": "เก้าอี้"
   },
   {
    "best_for": [
     "workshop",
     "seminar"
    ],
    "has_tables": true,
    "id": "classroom",
    "name_en": "Classroom",
    "name_th": "ห้องเรียน (โต๊ะยาวหันหน้าเวที)",
    "seats_per_unit": 2,
    "sqm_per_person": {
     "comfort": 2.2,
     "standard": 1.8,
     "tight": 1.5
    },
    "unit_name": "โต๊ะยาว 1.8 ม."
   },
   {
    "best_for": [
     "wedding_banquet"
    ],
    "has_tables": true,
    "id": "banquet",
    "name_en": "Banquet Round",
    "name_th": "โต๊ะจีน/โต๊ะกลม (10 ที่นั่งต่อโต๊ะ)",
    "seats_per_unit": 10,
    "sqm_per_person": {
     "comfort": 2.0,
     "standard": 1.7,
     "tight": 1.4
    },
    "unit_name": "โต๊ะกลม"
   },
   {
    "best_for": [
     "workshop",
     "seminar",
     "wedding_banquet"
    ],
    "has_tables": true,
    "id": "cabaret",
    "name_en": "Cabaret",
    "name_th": "คาบาเรต์ (โต๊ะกลมนั่งครึ่งวง หันหน้าเวที)",
    "seats_per_unit": 6,
    "sqm_per_person": {
     "comfort": 2.2,
     "standard": 1.8,
     "tight": 1.5
    },
    "unit_name": "โต๊ะกลม"
   },
   {
    "best_for": [
     "networking",
     "exhibition",
     "product_launch"
    ],
    "has_tables": true,
    "id": "cocktail",
    "name_en": "Cocktail / Standing",
    "name_th": "ค็อกเทล (ยืนเดินสังสรรค์)",
    "seats_per_unit": 8,
    "sqm_per_person": {
     "comfort": 1.2,
     "standard": 0.9,
     "tight": 0.7
    },
    "unit_name": "โต๊ะค็อกเทล"
   },
   {
    "best_for": [
     "workshop"
    ],
    "has_tables": true,
    "id": "u_shape",
    "name_en": "U-Shape",
    "name_th": "ตัวยู (U-Shape)",
    "seats_per_unit": 2,
    "sqm_per_person": {
     "comfort": 3.2,
     "standard": 2.6,
     "tight": 2.2
    },
    "unit_name": "โต๊ะยาว 1.8 ม."
   }
  ]
 },
 "prompts": {
  "_meta": {
   "description": "Prompt Engineering: prompt ที่ใช้สอน LLM ให้ทำงานเฉพาะทางของระบบนี้ (ใช้ร่วมกันทั้ง Python และ JavaScript)",
   "design": "LLM ทำหน้าที่ 'อ่านโจทย์' และ 'อธิบายผล' เท่านั้น ส่วนตัวเลขพื้นที่/จำนวนอุปกรณ์/ราคา คำนวณด้วย rule engine เพื่อให้ถูกต้องและตรวจสอบย้อนกลับได้",
   "placeholders": [
    "{EVENT_TYPES}",
    "{LAYOUTS}",
    "{COMPONENTS}"
   ]
  },
  "advise_system": "คุณเป็นที่ปรึกษาการจัดอีเวนต์ ตอบเป็นภาษาไทย 4-6 ข้อสั้น ๆ (ขึ้นต้นแต่ละข้อด้วย '- ') จากข้อมูลแผนในรูป JSON ที่ให้เท่านั้น กฎ: (1) ห้ามแต่งตัวเลข พื้นที่ จำนวน หรือราคาใหม่ ใช้เฉพาะตัวเลขที่อยู่ใน JSON (2) บอกว่าแผนนี้เหมาะกับงานอย่างไร (3) ชี้ความเสี่ยงสำคัญ 1-2 ข้อ เช่น ทางออก ห้องน้ำ คิวอาหาร หรืองบที่ตึงเกินไป (4) เสนอทางเลือกประหยัดงบหรือเพิ่มความสะดวก 1-2 ข้อ โดยอ้างอิงตัวเลือกระดับงบ (tier_options) ที่ให้ (5) ไม่ต้องทักทายหรือสรุปซ้ำ",
  "extract_examples": [
   {
    "input": "งานสัมมนา 100 คน มีเวทีและซุ้มอาหาร งบ 5 หมื่นบาท",
    "output": {
     "budget_thb": 50000,
     "components": [
      "stage",
      "buffet"
     ],
     "event_type": "seminar",
     "layout": null,
     "people": 100,
     "tier": null
    }
   },
   {
    "input": "Wedding dinner for 250 guests, round tables, premium style, with dance floor",
    "output": {
     "budget_thb": null,
     "components": [
      "dance_floor"
     ],
     "event_type": "wedding_banquet",
     "layout": "banquet",
     "people": 250,
     "tier": "premium"
    }
   },
   {
    "input": "อยากจัดงานเล็ก ๆ",
    "output": {
     "budget_thb": null,
     "components": [],
     "event_type": null,
     "layout": null,
     "people": null,
     "tier": null
    }
   }
  ],
  "extract_system": "You are the intake parser of an event & venue space planning tool. Read the user's request (Thai or English) and output ONLY one JSON object with exactly these keys:\n- event_type: one of [{EVENT_TYPES}] or null\n- people: integer number of attendees, or null\n- tier: \"basic\" | \"standard\" | \"premium\" | null (basic = economical/budget-friendly, premium = luxurious)\n- layout: one of [{LAYOUTS}] or null (only when the user clearly states a seating style)\n- components: array of ids from [{COMPONENTS}] that the user explicitly asks for (stage, food/buffet, registration, booths, photo corner, VIP lounge, dance floor, AV control booth)\n- budget_thb: integer amount in Thai baht, or null\nRules: never guess. If a value is not stated, use null (or [] for components). Convert Thai numerals and Thai number words (1 พัน=1000, 1 หมื่น=10000, 1 แสน=100000, 1 ล้าน=1000000). Output JSON only, no explanation, no markdown."
 },
 "venue_rules": {
  "_meta": {
   "description": "กฎการคำนวณพื้นที่ส่วนประกอบ (components) และข้อกำหนดทั่วไปของงาน หน่วย ตร.ม. ยกเว้นระบุเป็นอย่างอื่น"
  },
  "ceiling_height_min_m": 3.0,
  "circulation_ratio": {
   "comfort": 0.3,
   "standard": 0.2,
   "tight": 0.15
  },
  "components": [
   {
    "id": "stage",
    "name_th": "เวที",
    "rule": {
     "tiers": [
      {
       "max_people": 50,
       "sqm": 12
      },
      {
       "max_people": 150,
       "sqm": 24
      },
      {
       "max_people": 300,
       "sqm": 36
      },
      {
       "max_people": 1000000,
       "sqm": 60
      }
     ],
     "type": "tiered_by_people"
    }
   },
   {
    "id": "buffet",
    "name_th": "โซนอาหาร/ซุ้มบุฟเฟต์",
    "rule": {
     "min_units": 1,
     "n": 50,
     "sqm_per_unit": 12,
     "type": "per_n_people"
    }
   },
   {
    "id": "registration",
    "name_th": "โต๊ะลงทะเบียน",
    "rule": {
     "min_units": 1,
     "n": 100,
     "sqm_per_unit": 8,
     "type": "per_n_people"
    }
   },
   {
    "id": "av_booth",
    "name_th": "ห้องควบคุมภาพ/เสียง (AV Booth)",
    "rule": {
     "sqm": 4,
     "type": "fixed"
    }
   },
   {
    "id": "photo_corner",
    "name_th": "มุมถ่ายภาพ",
    "rule": {
     "sqm": 9,
     "type": "fixed"
    }
   },
   {
    "id": "booths",
    "name_th": "บูธนิทรรศการ",
    "rule": {
     "min_units": 2,
     "n": 25,
     "sqm_per_unit": 9,
     "type": "per_n_people"
    }
   },
   {
    "id": "lounge",
    "name_th": "มุมพักผ่อน/รับรอง VIP",
    "rule": {
     "sqm": 16,
     "type": "fixed"
    }
   },
   {
    "id": "dance_floor",
    "name_th": "ฟลอร์เต้นรำ",
    "rule": {
     "min_units": 4,
     "n": 10,
     "sqm_per_unit": 6,
     "type": "per_n_people"
    }
   }
  ],
  "exit_width_m_per_100_people": 1.0,
  "min_exits": 2,
  "restroom_rule": {
   "note": "ประมาณการเบื้องต้น 1 ที่ต่อ 40 คน",
   "people_per_toilet": 40
  }
 }
};
