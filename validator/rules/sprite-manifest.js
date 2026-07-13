// rules/sprite-manifest.js
// RULE-R04 — Image.sprite 참조 일치
// [LLM+VALIDATOR]
//
// Image 컴포넌트의 properties.sprite 값은
// 반드시 asset_manifest.ui_sprites 배열에 선언된 이름 중 하나여야 한다.

/**
 * @param {object} gdf - 파싱된 GDF 객체
 * @returns {Array<{code, severity, path, message}>}
 */
export function validateSpriteManifest(gdf) {
  const errors = [];
  const declared = new Set(gdf.asset_manifest.ui_sprites);

  for (const scene of gdf.scenes) {
    for (const obj of scene.gameObjects) {
      for (const comp of obj.components) {
        if (comp.name === "Image" && comp.properties?.sprite !== undefined) {
          if (!declared.has(comp.properties.sprite)) {
            errors.push({
              code:     "GDS_R04",
              severity: "error",
              path:     `scenes[${scene.scene_name}].gameObjects[${obj.uid}].Image.sprite`,
              message:  `sprite "${comp.properties.sprite}"이 asset_manifest.ui_sprites에 선언되지 않았다.`
            });
          }
        }
      }
    }
  }

  return errors;
}
