// validator.js
// GDS L1 Schema Conformance Validator
// Node.js >= 21 (권장: v22 LTS) — Import Attributes (with { type: "json" }) 사용

import Ajv from "ajv/dist/2019.js";
import schema from "./GDS.json" with { type: "json" };

import { validateParentUid }            from "./rules/referential-integrity.js";
import { validateCanvasHierarchy }      from "./rules/canvas-hierarchy.js";
import { validateAudioManifest }        from "./rules/audio-manifest.js";
import { validateSpriteManifest }       from "./rules/sprite-manifest.js";
import { validatePrefabManifest }       from "./rules/prefab-manifest.js";
import { validateObjectPairing }        from "./rules/object-pairing.js";
import { validateCompositeUIStructure } from "./rules/composite-ui-structure.js";
import { validateGddContracts }         from "./rules/gdd-contract-validator.js";

// ── 3-A. ajv 셋업 ──────────────────────────────────────────────────────────
//
// allErrors: true  — 첫 에러에서 중단하지 않고 전체 순회 후 복수 에러 일괄 리포트
// strict: true     — 스키마에 선언되지 않은 키워드 발견 시 에러로 처리
//
const ajv = new Ajv({ allErrors: true, strict: true });
const validateSchema = ajv.compile(schema);

// ── path 변환 유틸리티 ────────────────────────────────────────────────────
//
// ajv가 생성하는 JSON Pointer(RFC 6901) 형식의 instancePath를
// 커스텀 룰과 동일한 이름 기반 경로로 변환한다.
//
// 변환 규칙:
//   /scenes/0              → scenes[IngameScene]
//   /scenes/0/gameObjects/1 → scenes[IngameScene].gameObjects[obj_camera_main]
//   /scenes/0/gameObjects/1/components/0 → scenes[IngameScene].gameObjects[obj_camera_main].components[0]
//
// 엣지 케이스:
//   - uid 자체가 누락된 오브젝트(tag/layer 누락 등) → UNRESOLVED:N 마커로 폴백
//   - 씬 인덱스가 범위를 벗어난 경우               → UNRESOLVED:N 마커로 폴백
//   - instancePath가 빈 문자열("")인 경우           → "(root)" 반환
//   - 변환 로직이 커버하지 못하는 경로 세그먼트      → 원본 세그먼트 그대로 보존
//
// 다중 씬 GDF 처리:
//   ajv의 gameObjects 인덱스는 씬별 로컬 인덱스다.
//   /scenes/1/gameObjects/2 → gdf.scenes[1].gameObjects[2]
//   씬 인덱스를 먼저 추출한 후 해당 씬 내에서만 gameObjects를 참조한다.
//
/**
 * @param {string} instancePath - ajv가 생성한 JSON Pointer 경로 (예: "/scenes/0/gameObjects/1")
 * @param {object} gdf          - 파싱된 GDF 객체
 * @returns {string}            - 이름 기반 경로 (예: "scenes[IngameScene].gameObjects[obj_camera_main]")
 */
function resolveAjvPath(instancePath, gdf) {
  if (!instancePath) return "(root)";

  const parts = instancePath.split("/").filter(Boolean);
  // 예: ["scenes", "0", "gameObjects", "1", "components", "0"]

  const segments = []; // 최종 조립에 사용할 경로 세그먼트 배열
  let i = 0;
  let currentSceneIdx = null; // 씬 인덱스를 추출한 뒤 gameObjects 해석에 재사용

  while (i < parts.length) {
    const part = parts[i];

    // ── scenes[N] → scenes[scene_name] ──────────────────────────────────
    if (part === "scenes" && i + 1 < parts.length) {
      const rawIdx = parts[i + 1];
      const sceneIdx = parseInt(rawIdx, 10);

      if (!Number.isNaN(sceneIdx)) {
        currentSceneIdx = sceneIdx;
        const sceneName = gdf.scenes?.[sceneIdx]?.scene_name
          ?? `UNRESOLVED:${sceneIdx}`;
        segments.push(`scenes[${sceneName}]`);
        i += 2;
      } else {
        // 인덱스가 숫자가 아닌 예외 상황 — 원본 보존
        segments.push(`scenes[${rawIdx}]`);
        i += 2;
      }
      continue;
    }

    // ── gameObjects[N] → gameObjects[uid] ───────────────────────────────
    if (part === "gameObjects" && i + 1 < parts.length) {
      const rawIdx = parts[i + 1];
      const objIdx = parseInt(rawIdx, 10);

      if (!Number.isNaN(objIdx)) {
        // 앞서 추출한 씬 인덱스를 기준으로 해당 씬 내 gameObjects만 참조
        const uid = (currentSceneIdx !== null)
          ? gdf.scenes?.[currentSceneIdx]?.gameObjects?.[objIdx]?.uid
          : undefined;

        segments.push(`.gameObjects[${uid ?? `UNRESOLVED:${objIdx}`}]`);
        i += 2;
      } else {
        segments.push(`.gameObjects[${rawIdx}]`);
        i += 2;
      }
      continue;
    }

    // ── 나머지 세그먼트 (components, properties 등) ──────────────────────
    // 첫 세그먼트가 아닌 경우 점(.)으로 연결
    const prefix = segments.length > 0 ? "." : "";
    segments.push(`${prefix}${part}`);
    i++;
  }

  const resolved = segments.join("");
  // 변환 결과가 비어 있으면 원본 반환 (안전 폴백)
  return resolved || instancePath;
}

// ── 3-C. 통합 진입점 ────────────────────────────────────────────────────────
//
// 반환 포맷:
// {
//   valid: boolean,
//   errors: Array<{
//     code:     string,   // "GDS_SCHEMA" | "GDS_R01" | "GDS_R02" | "GDS_R03" | "GDS_R04" | "GDS_R05"
//     severity: "error",
//     path:     string,   // "scenes[<scene_name>].gameObjects[<uid>]..." 형태로 통일
//     message:  string
//   }>
// }
//
export function validate(gdf) {
  // ── 진입부 가드 ────────────────────────────────────────────────────────────
  //
  // 커스텀 룰 4건은 gdf.scenes 배열과 gdf.asset_manifest 객체를 직접 순회한다.
  // 최상위 구조 자체가 깨진 GDF(scenes 누락, asset_manifest 누락)가 입력되면
  // 커스텀 룰이 JSON Schema 에러가 아닌 TypeError 런타임 예외로 터지므로,
  // ajv 검증 전에 최소 구조를 확인하고 조기 반환한다.
  //
  // 조기 반환 조건:
  //   - gdf 자체가 falsy
  //   - gdf.scenes 가 배열이 아님 (누락 포함)
  //   - gdf.asset_manifest 가 객체가 아님 (누락 포함)
  //
  if (
    !gdf ||
    !Array.isArray(gdf.scenes) ||
    typeof gdf.asset_manifest !== "object" ||
    gdf.asset_manifest === null
  ) {
    return {
      valid: false,
      errors: [{
        code:     "GDS_SCHEMA",
        severity: "error",
        path:     "(root)",
        message:  "GDF 최상위 구조 불완전: scenes(배열) 또는 asset_manifest(객체) 가 누락되었습니다."
      }]
    };
  }

  // Phase 1: JSON Schema 검증 (ajv)
  const schemaValid = validateSchema(gdf);
  const schemaErrors = schemaValid
    ? []
    : validateSchema.errors.map(e => ({
        code:     "GDS_SCHEMA",
        severity: "error",
        path:     resolveAjvPath(e.instancePath, gdf), // ← 이름 기반 경로로 변환
        message:  e.message
      }));

  // Phase 2: 커스텀 룰 검증 (cross-reference)
  // 스키마 에러가 있어도 커스텀 룰을 실행한다.
  // gdf 구조가 최소한 파싱 가능한 수준이라면 독립적으로 에러를 수집하는 것이
  // L2 Delta Detection에서 에러 분류를 더 명확하게 한다.
  const customErrors = [
    ...validateParentUid(gdf),
    ...validateCanvasHierarchy(gdf),
    ...validateAudioManifest(gdf),
    ...validateSpriteManifest(gdf),
    ...validatePrefabManifest(gdf),
    ...validateObjectPairing(gdf),
    ...validateCompositeUIStructure(gdf)
  ];

  const allErrors = [...schemaErrors, ...customErrors]
    .filter(e => !/must match "(then|else|if)" schema/.test(e.message));

  return {
    valid:  allErrors.length === 0,
    errors: allErrors
  };
}

export async function validateWithGddContract(gdf, gddText) {
  const [gdsResult, contractResult] = await Promise.all([
    Promise.resolve().then(() => validate(gdf)),
    Promise.resolve().then(() => validateGddContracts(gddText, gdf))
  ]);

  const errors = [
    ...(gdsResult.errors ?? []),
    ...(contractResult.errors ?? [])
  ];

  return {
    valid: gdsResult.valid === true && contractResult.valid === true,
    errors,
    warnings: contractResult.warnings ?? [],
    checks: {
      gds: {
        valid: gdsResult.valid === true,
        error_count: gdsResult.errors?.length ?? 0
      },
      contract: {
        valid: contractResult.valid === true,
        error_count: contractResult.errors?.length ?? 0,
        warning_count: contractResult.warnings?.length ?? 0,
        contract_count: contractResult.contracts?.length ?? 0
      }
    }
  };
}
