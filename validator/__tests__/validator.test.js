// __tests__/validator.test.js
// D2D Phase 4 — L1 Schema Conformance Validator 단위 테스트
//
// Part A: valid 픽스처 — false positive 방어 (정상 GDF가 오류를 유발하지 않아야 함)
// Part B: GDS_SCHEMA 에러 픽스처 — ajv if/then/else 분기 및 required 위반 검증
// Part C: 커스텀 룰 에러 픽스처 — RULE-R01 ~ R04 위반 검증

import { validate } from "../validator.js";
import fs           from "fs";
import path         from "path";
import { fileURLToPath } from "url";

// ESM 환경에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/**
 * 픽스처 JSON 로더
 * @param {"valid"|"invalid"} dir
 * @param {string} file
 * @returns {object}
 */
function loadFixture(dir, file) {
  const fixturePath = path.join(__dirname, dir, file);
  const raw = fs.readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Part A — valid 픽스처 (false positive guard)
// 정상 GDF를 입력했을 때 valid: true, errors: [] 를 반환해야 한다.
// ─────────────────────────────────────────────────────────────────────────────

describe("Part A — valid fixtures (false positive guard)", () => {
  const VALID_CASES = [
    {
      name: "valid_minimal",
      file: "valid_minimal.json",
      desc: "3D 오브젝트만 포함, UI·오디오 없음 — 최소 구성 GDF"
    },
    {
      name: "valid_full_hud",
      file: "valid_full_hud.json",
      desc: "Canvas + Button + AudioSource 포함 — 풀 HUD 구성 GDF"
    },
    {
      name: "valid_camera",
      file: "valid_camera.json",
      desc: "Camera 컴포넌트 표현 — type 필드 미사용 (RULE-G06)"
    },
    {
      name: "valid_audio_without_clip",
      file: "valid_audio_without_clip.json",
      desc: "외부 오디오 에셋 없이 AudioSource clip 생략 허용"
    },
    {
      name: "valid_g08_canvas_eventsystem",
      file: "valid_g08_canvas_eventsystem.json",
      desc: "Canvas + EventSystem + Button + Text 자식 정상 구성 (RULE-G08)"
    },
    {
      name: "valid_g09_slider",
      file: "valid_g09_slider.json",
      desc: "Slider 표준 자식 트리 정상 구성 (RULE-G09)"
    },
    {
      name: "valid_g09_toggle",
      file: "valid_g09_toggle.json",
      desc: "Toggle 표준 자식 트리 정상 구성 (RULE-G09)"
    },
    {
      name: "valid_g09_dropdown",
      file: "valid_g09_dropdown.json",
      desc: "Dropdown 표준 자식 트리 정상 구성 5단계 (RULE-G09)"
    },
    {
      name: "valid_g09_scrollbar",
      file: "valid_g09_scrollbar.json",
      desc: "Scrollbar 표준 자식 트리 정상 구성 (RULE-G09)"
    },
  ];

  test.each(VALID_CASES)("$name — $desc", ({ file }) => {
    const gdf    = loadFixture("valid", file);
    const result = validate(gdf);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Part B — GDS_SCHEMA 에러 픽스처 (false negative guard)
// ajv JSON Schema 검증이 정확히 위반을 감지해야 한다.
//
// 검증 포인트:
//   - GDS_SCHEMA 코드를 포함한 errors 가 1건 이상 존재해야 한다.
//   - valid: false 여야 한다.
//
// 픽스처 설계 원칙:
//   - 하나의 파일 = 하나의 결함 (valid_minimal.json 기반 최소 변형)
//   - 커스텀 룰(R01~R04) 위반 없이 순수 스키마 위반만 포함
// ─────────────────────────────────────────────────────────────────────────────

describe("Part B — GDS_SCHEMA 에러 픽스처 (ajv)", () => {

  // ── B-1: uid 필드 누락 ───────────────────────────────────────────────────
  //
  // GameObject.$defs 의 required 배열에 "uid" 가 선언되어 있으므로
  // uid 가 없는 경우 ajv 가 "must have required property 'uid'" 에러를 발생시킨다.
  //
  test("err_missing_uid → GDS_SCHEMA (required: uid)", () => {
    const gdf    = loadFixture("invalid", "err_missing_uid.json");
    const result = validate(gdf);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors.some(e => e.code === "GDS_SCHEMA")).toBe(true);
  });

  // ── B-2: tag 필드 누락 ───────────────────────────────────────────────────
  //
  // GameObject.$defs 의 required 배열에 "tag" 가 선언되어 있으므로
  // tag 가 없는 경우 ajv 가 "must have required property 'tag'" 에러를 발생시킨다.
  //
  test("err_missing_tag → GDS_SCHEMA (required: tag)", () => {
    const gdf    = loadFixture("invalid", "err_missing_tag.json");
    const result = validate(gdf);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors.some(e => e.code === "GDS_SCHEMA")).toBe(true);
  });

  // ── B-3: UI 오브젝트에 transform 혼용 ────────────────────────────────────
  //
  // GDS.json GameObject 정의의 if/then/else 분기:
  //   if   layer === "UI"
  //   then rectTransform 필수 + transform 금지 (not: { required: ["transform"] })
  //   else transform 필수 + rectTransform 금지
  //
  // 픽스처: layer="UI" 인 obj_panel_01 에 rectTransform 대신 transform 삽입.
  // Canvas 루트(obj_canvas_01)는 정상(rectTransform 보유)이며,
  // 결함은 자식 UI 오브젝트에만 존재한다.
  //
  // ajv 가 then 브랜치의 "not: { required: ['transform'] }" 조건 위반을 감지해야 한다.
  //
  test("err_ui_has_transform → GDS_SCHEMA (if/then: UI layer must not have transform)", () => {
    const gdf    = loadFixture("invalid", "err_ui_has_transform.json");
    const result = validate(gdf);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors.some(e => e.code === "GDS_SCHEMA")).toBe(true);

    // 경로가 문제 오브젝트를 가리키는지 확인
    // resolveAjvPath 가 인덱스를 uid 로 변환하므로 obj_panel_01 이 포함되어야 한다.
    const panelError = result.errors.find(
      e => e.code === "GDS_SCHEMA" && e.path.includes("obj_panel_01")
    );
    expect(panelError).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Part C — 커스텀 룰 에러 픽스처 (false negative guard)
// referential-integrity.js / canvas-hierarchy.js /
// audio-manifest.js / sprite-manifest.js 가 정확히 위반을 감지해야 한다.
//
// 검증 포인트:
//   - 해당 RULE 코드(GDS_R01 ~ R04)를 포함한 errors 가 1건 이상 존재해야 한다.
//   - valid: false 여야 한다.
//
// 픽스처 설계 원칙:
//   - 하나의 파일 = 하나의 결함 (valid_minimal.json 기반 최소 변형)
//   - JSON Schema 위반(GDS_SCHEMA) 없이 순수 커스텀 룰 위반만 포함
// ─────────────────────────────────────────────────────────────────────────────

describe("Part C — 커스텀 룰 에러 픽스처 (RULE-R01 ~ R04)", () => {

  // ── C-1: 존재하지 않는 parent_uid 참조 (RULE-R01) ────────────────────────
  //
  // obj_child_01.parent_uid = "obj_nonexistent_9999"
  // 해당 uid는 같은 씬 gameObjects에 존재하지 않는다.
  // referential-integrity.js 가 GDS_R01 에러를 발생시켜야 한다.
  //
  // 픽스처 구성:
  //   - obj_cube_01   : 정상 루트 오브젝트 (parent_uid: null)
  //   - obj_child_01  : 결함 오브젝트 (parent_uid: "obj_nonexistent_9999")
  //
  test("err_broken_parent → GDS_R01 (parent_uid references non-existent uid)", () => {
    const gdf    = loadFixture("invalid", "err_broken_parent.json");
    const result = validate(gdf);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors.some(e => e.code === "GDS_R01")).toBe(true);

    // 에러 경로가 결함 오브젝트(obj_child_01)를 정확히 가리키는지 확인
    const r01Error = result.errors.find(
      e => e.code === "GDS_R01" && e.path.includes("obj_child_01")
    );
    expect(r01Error).toBeDefined();

    // 에러 메시지에 잘못 참조된 uid 이름이 포함되어야 한다
    expect(r01Error.message).toContain("obj_nonexistent_9999");
  });

  // ── C-2: UI 오브젝트가 Canvas 계층 밖에 배치 (RULE-R02) ──────────────────
  //
  // obj_orphan_ui_01 은 layer="UI" 이지만, 부모가 Canvas 컴포넌트를
  // 보유하지 않는 일반 3D 오브젝트(obj_cube_01)다.
  // canvas-hierarchy.js 가 GDS_R02 에러를 발생시켜야 한다.
  //
  // 픽스처 구성:
  //   - obj_cube_01       : 정상 3D 오브젝트 (Canvas 컴포넌트 없음)
  //   - obj_orphan_ui_01  : 결함 UI 오브젝트 (parent → obj_cube_01, Canvas 계층 밖)
  //
  // 스키마 적합성 유지 전략:
  //   - obj_orphan_ui_01 은 layer="UI" 이므로 rectTransform 사용 → GDS_SCHEMA 위반 없음
  //   - parent_uid "obj_cube_01" 은 같은 씬에 존재 → GDS_R01 위반 없음
  //
  test("err_ui_no_canvas → GDS_R02 (UI object placed outside Canvas hierarchy)", () => {
    const gdf    = loadFixture("invalid", "err_ui_no_canvas.json");
    const result = validate(gdf);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors.some(e => e.code === "GDS_R02")).toBe(true);

    // 에러 경로가 결함 UI 오브젝트(obj_orphan_ui_01)를 정확히 가리키는지 확인
    const r02Error = result.errors.find(
      e => e.code === "GDS_R02" && e.path.includes("obj_orphan_ui_01")
    );
    expect(r02Error).toBeDefined();
  });

  // ── C-3: AudioSource.clip 이 asset_manifest.audio 에 미선언 (RULE-R03) ───
  //
  // obj_cube_01 의 AudioSource.properties.clip = "SFX_Undeclared"
  // asset_manifest.audio 에는 "BGM_Main" 만 선언되어 있어 일치하지 않는다.
  // audio-manifest.js 가 GDS_R03 에러를 발생시켜야 한다.
  //
  // 픽스처 구성:
  //   - asset_manifest.audio : ["BGM_Main"]
  //   - obj_cube_01.AudioSource.clip : "SFX_Undeclared"  ← 결함
  //
  test("err_clip_not_declared → GDS_R03 (AudioSource.clip not in asset_manifest.audio)", () => {
    const gdf    = loadFixture("invalid", "err_clip_not_declared.json");
    const result = validate(gdf);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors.some(e => e.code === "GDS_R03")).toBe(true);

    // 에러 메시지에 미선언 clip 이름이 포함되어야 한다
    const r03Error = result.errors.find(e => e.code === "GDS_R03");
    expect(r03Error.message).toContain("SFX_Undeclared");
  });

  // ── C-4: Image.sprite 가 asset_manifest.ui_sprites 에 미선언 (RULE-R04) ──
  //
  // obj_img_01 의 Image.properties.sprite = "UI_Icon_Undeclared"
  // asset_manifest.ui_sprites 에는 "UI_Btn_Play" 만 선언되어 있어 일치하지 않는다.
  // sprite-manifest.js 가 GDS_R04 에러를 발생시켜야 한다.
  //
  // 픽스처 구성:
  //   - asset_manifest.ui_sprites : ["UI_Btn_Play"]
  //   - obj_img_01.Image.sprite   : "UI_Icon_Undeclared"  ← 결함
  //
  // 스키마 적합성 및 R01·R02 유지 전략:
  //   - Canvas 계층(obj_canvas_01 → obj_img_01) 정상 구성 → GDS_R02 위반 없음
  //   - parent_uid 참조 정상 → GDS_R01 위반 없음
  //   - UI 오브젝트 모두 rectTransform 사용 → GDS_SCHEMA 위반 없음
  //
  test("err_sprite_not_declared → GDS_R04 (Image.sprite not in asset_manifest.ui_sprites)", () => {
    const gdf    = loadFixture("invalid", "err_sprite_not_declared.json");
    const result = validate(gdf);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors.some(e => e.code === "GDS_R04")).toBe(true);

    // 에러 메시지에 미선언 sprite 이름이 포함되어야 한다
    const r04Error = result.errors.find(e => e.code === "GDS_R04");
    expect(r04Error.message).toContain("UI_Icon_Undeclared");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Part D — RULE-G08 / G09 에러 픽스처 (false negative guard)
// object-pairing.js / composite-ui-structure.js 가 정확히 위반을 감지해야 한다.
//
// 검증 포인트:
//   - 해당 RULE 코드(GDS_G08 / GDS_G09)를 포함한 errors 가 1건 이상 존재해야 한다.
//   - valid: false 여야 한다.
//
// 픽스처 설계 원칙:
//   - 하나의 파일 = 하나의 결함
//   - GDS_SCHEMA / GDS_R01~R05 위반 없이 순수 G08 / G09 위반만 포함
// ─────────────────────────────────────────────────────────────────────────────

describe("Part D — RULE-G08 / G09 에러 픽스처", () => {

  // ── D-1: Canvas 있음, EventSystem 없음 (RULE-G08) ─────────────────────────
  test("err_g08_missing_eventsystem → GDS_G08 (Canvas without EventSystem)", () => {
    const gdf    = loadFixture("invalid", "err_g08_missing_eventsystem.json");
    const result = validate(gdf);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "GDS_G08")).toBe(true);

    const err = result.errors.find(e => e.code === "GDS_G08");
    expect(err.message).toContain("EventSystem");
  });

  // ── D-2: EventSystem 오브젝트 2개 (RULE-G08) ─────────────────────────────
  test("err_g08_duplicate_eventsystem → GDS_G08 (EventSystem duplicated)", () => {
    const gdf    = loadFixture("invalid", "err_g08_duplicate_eventsystem.json");
    const result = validate(gdf);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "GDS_G08")).toBe(true);

    const err = result.errors.find(e => e.code === "GDS_G08");
    expect(err.message).toMatch(/2개/);
  });

  // ── D-3: Button에 Text/TMP 직계 자식 없음 (RULE-G08) ─────────────────────
  test("err_g08_button_no_text_child → GDS_G08 (Button missing text child)", () => {
    const gdf    = loadFixture("invalid", "err_g08_button_no_text_child.json");
    const result = validate(gdf);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "GDS_G08")).toBe(true);

    const err = result.errors.find(
      e => e.code === "GDS_G08" && e.path.includes("obj_btn_no_label")
    );
    expect(err).toBeDefined();
  });

  // ── D-4: ScrollRect에 Mask 자식(Viewport) 없음 (RULE-G08) ────────────────
  test("err_g08_scrollrect_no_viewport → GDS_G08 (ScrollRect missing Viewport)", () => {
    const gdf    = loadFixture("invalid", "err_g08_scrollrect_no_viewport.json");
    const result = validate(gdf);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "GDS_G08")).toBe(true);

    const err = result.errors.find(
      e => e.code === "GDS_G08" && e.message.includes("Viewport")
    );
    expect(err).toBeDefined();
  });

  // ── D-5: InputField에 Text 자식 1개뿐 (RULE-G08) ─────────────────────────
  test("err_g08_inputfield_one_text_child → GDS_G08 (InputField needs 2 text children)", () => {
    const gdf    = loadFixture("invalid", "err_g08_inputfield_one_text_child.json");
    const result = validate(gdf);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "GDS_G08")).toBe(true);

    const err = result.errors.find(
      e => e.code === "GDS_G08" && e.path.includes("obj_inputfield")
    );
    expect(err).toBeDefined();
  });

  // ── D-6: Slider에 Background 직계 자식 없음 (RULE-G09) ───────────────────
  test("err_g09_slider_missing_background → GDS_G09 (Slider missing Background)", () => {
    const gdf    = loadFixture("invalid", "err_g09_slider_missing_background.json");
    const result = validate(gdf);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "GDS_G09")).toBe(true);

    const err = result.errors.find(
      e => e.code === "GDS_G09" && e.message.includes("Background")
    );
    expect(err).toBeDefined();
  });

  // ── D-7: Fill Area 있으나 Fill 자식 없음 (RULE-G09) ──────────────────────
  test("err_g09_slider_missing_fill → GDS_G09 (Slider Fill Area missing Fill child)", () => {
    const gdf    = loadFixture("invalid", "err_g09_slider_missing_fill.json");
    const result = validate(gdf);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "GDS_G09")).toBe(true);

    const err = result.errors.find(
      e => e.code === "GDS_G09" && e.message.includes("Fill")
    );
    expect(err).toBeDefined();
  });

  // ── D-8: Background 있으나 Checkmark 자식 없음 (RULE-G09) ────────────────
  test("err_g09_toggle_missing_checkmark → GDS_G09 (Toggle Background missing Checkmark)", () => {
    const gdf    = loadFixture("invalid", "err_g09_toggle_missing_checkmark.json");
    const result = validate(gdf);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "GDS_G09")).toBe(true);

    const err = result.errors.find(
      e => e.code === "GDS_G09" && e.message.includes("Checkmark")
    );
    expect(err).toBeDefined();
  });

  // ── D-9: Dropdown에 Template 직계 자식 없음 (RULE-G09) ───────────────────
  test("err_g09_dropdown_missing_template → GDS_G09 (Dropdown missing Template)", () => {
    const gdf    = loadFixture("invalid", "err_g09_dropdown_missing_template.json");
    const result = validate(gdf);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "GDS_G09")).toBe(true);

    const err = result.errors.find(
      e => e.code === "GDS_G09" && e.message.includes("Template")
    );
    expect(err).toBeDefined();
  });

  // ── D-10: Sliding Area 있으나 Handle 자식 없음 (RULE-G09) ────────────────
  test("err_g09_scrollbar_missing_handle → GDS_G09 (Scrollbar Sliding Area missing Handle)", () => {
    const gdf    = loadFixture("invalid", "err_g09_scrollbar_missing_handle.json");
    const result = validate(gdf);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === "GDS_G09")).toBe(true);

    const err = result.errors.find(
      e => e.code === "GDS_G09" && e.message.includes("Handle")
    );
    expect(err).toBeDefined();
  });
});