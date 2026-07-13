// rules/canvas-hierarchy.js
// RULE-R02 — UI 오브젝트의 Canvas 자식 강제
// [VALIDATOR]
//
// layer가 "UI"이고 Canvas 컴포넌트를 보유하지 않는 오브젝트는,
// 상위 체인을 순회하여 Canvas 컴포넌트를 보유한 조상이 반드시 존재해야 한다.
// Canvas 컴포넌트를 직접 보유한 오브젝트(루트 Canvas)는 자기 자신이 조건을 충족한다.
//
// visited Set을 사용하여 parent_uid 순환 참조로 인한 무한 재귀를 방어한다.
// (R01이 선행 실행되더라도 R02 실행 시점에 순환 참조 차단을 독립적으로 보장한다.)

/**
 * @param {object} gdf - 파싱된 GDF 객체
 * @returns {Array<{code, severity, path, message}>}
 */
export function validateCanvasHierarchy(gdf) {
  const errors = [];

  for (const scene of gdf.scenes) {
    const objMap = new Map(scene.gameObjects.map(o => [o.uid, o]));

    /**
     * obj 자신 또는 상위 체인에 Canvas 컴포넌트를 보유한 오브젝트가 있는지 재귀 탐색.
     * @param {object} obj
     * @param {Set<string>} visited - 순환 참조 방어용
     * @returns {boolean}
     */
    function hasCanvasAncestor(obj, visited = new Set()) {
      if (visited.has(obj.uid)) return false; // 순환 참조 차단
      visited.add(obj.uid);

      const hasCanvas = obj.components.some(c => c.name === "Canvas");
      if (hasCanvas) return true;
      if (!obj.parent_uid) return false;

      const parent = objMap.get(obj.parent_uid);
      return parent ? hasCanvasAncestor(parent, visited) : false;
    }

    for (const obj of scene.gameObjects) {
      if (obj.layer === "UI" && !hasCanvasAncestor(obj)) {
        errors.push({
          code:     "GDS_R02",
          severity: "error",
          path:     `scenes[${scene.scene_name}].gameObjects[${obj.uid}]`,
          message:  `UI 오브젝트 "${obj.uid}"가 Canvas 계층 하위에 없다.`
        });
      }
    }
  }

  return errors;
}
