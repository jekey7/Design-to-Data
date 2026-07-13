// rules/prefab-manifest.js
// RULE-R05 — prefab: 참조 선언 일치
// [LLM+VALIDATOR]
//
// 컴포넌트 properties 내 "prefab:" prefix를 가진 값은
// 반드시 asset_manifest.prefabs 배열에 선언된 이름 중 하나여야 한다.

/**
 * @param {object} gdf - 파싱된 GDF 객체
 * @returns {Array<{code, severity, path, message}>}
 */
export function validatePrefabManifest(gdf) {
  const errors = [];
  const declared = new Set(gdf.asset_manifest.prefabs ?? []);

  for (const scene of gdf.scenes) {
    for (const obj of scene.gameObjects) {
      for (const comp of obj.components) {
        if (!comp.properties) continue;
        for (const [key, val] of Object.entries(comp.properties)) {
          if (typeof val === "string" && val.startsWith("prefab:")) {
            const prefabName = val.slice("prefab:".length);
            if (!declared.has(prefabName)) {
              errors.push({
                code:     "GDS_R05",
                severity: "error",
                path:     `scenes[${scene.scene_name}].gameObjects[${obj.uid}].${comp.name}.${key}`,
                message:  `prefab 참조 "${prefabName}"이 asset_manifest.prefabs에 선언되지 않았다.`
              });
            }
          }
        }
      }
    }
  }
  return errors;
}
