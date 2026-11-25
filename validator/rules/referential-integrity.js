// rules/referential-integrity.js
// RULE-R01 — parent_uid 참조 무결성
// [VALIDATOR]
//
// parent_uid가 null이 아닌 경우, 해당 값은 동일 scene의
// gameObjects 내 uid 집합에 반드시 존재해야 한다.

/**
 * @param {object} gdf - 파싱된 GDF 객체
 * @returns {Array<{code, severity, path, message}>}
 */
export function validateParentUid(gdf) {
  const errors = [];

  for (const scene of gdf.scenes) {
    const uidSet = new Set(scene.gameObjects.map(o => o.uid));

    for (const obj of scene.gameObjects) {
      if (obj.parent_uid !== null && !uidSet.has(obj.parent_uid)) {
        errors.push({
          code:     "GDS_R01",
          severity: "error",
          path:     `scenes[${scene.scene_name}].gameObjects[${obj.uid}].parent_uid`,
          message:  `parent_uid "${obj.parent_uid}"가 같은 씬에 존재하지 않는다.`
        });
      }
    }
  }

  return errors;
}

// RULE-R06 — uid 고유성 [C4 V1]
// [VALIDATOR]
//
// 같은 scene 안에서 uid는 하나의 오브젝트만 가리켜야 한다.
// uid가 겹치면 parent_uid와 이벤트 참조가 어느 오브젝트를 뜻하는지 정할 수 없고,
// 빌더는 마지막 오브젝트로 덮어쓴다.
export function validateUniqueUid(gdf) {
  const errors = [];

  for (const scene of gdf.scenes) {
    const seen = new Map();
    for (const obj of scene.gameObjects ?? []) {
      seen.set(obj.uid, (seen.get(obj.uid) ?? 0) + 1);
    }
    for (const [uid, count] of seen) {
      if (count > 1) {
        errors.push({
          code:     "GDS_R06",
          severity: "error",
          path:     `scenes[${scene.scene_name}].gameObjects[${uid}].uid`,
          message:  `uid "${uid}"가 같은 씬에서 ${count}번 쓰였다.`
        });
      }
    }
  }

  return errors;
}
