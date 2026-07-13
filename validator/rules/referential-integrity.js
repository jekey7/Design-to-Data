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
