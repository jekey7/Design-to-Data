// rules/audio-manifest.js
// RULE-R03 — AudioSource.clip 참조 일치
// [LLM+VALIDATOR]
//
// AudioSource 컴포넌트의 properties.clip 값이 존재하면
// 반드시 asset_manifest.audio 배열에 선언된 이름 중 하나여야 한다.
// 외부 에셋 금지 GDD에서는 clip 생략과 빈 audio manifest를 허용한다.

/**
 * @param {object} gdf - 파싱된 GDF 객체
 * @returns {Array<{code, severity, path, message}>}
 */
export function validateAudioManifest(gdf) {
  const errors = [];
  const declared = new Set(gdf.asset_manifest.audio ?? []);

  for (const scene of gdf.scenes) {
    for (const obj of scene.gameObjects) {
      for (const comp of obj.components) {
        if (comp.name === "AudioSource" && comp.properties?.clip !== undefined) {
          if (!declared.has(comp.properties.clip)) {
            errors.push({
              code:     "GDS_R03",
              severity: "error",
              path:     `scenes[${scene.scene_name}].gameObjects[${obj.uid}].AudioSource.clip`,
              message:  `clip "${comp.properties.clip}"이 asset_manifest.audio에 선언되지 않았다.`
            });
          }
        }
      }
    }
  }

  return errors;
}
