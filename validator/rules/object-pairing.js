// rules/object-pairing.js
// RULE-G08 — 오브젝트 구성 페어링 원칙
// 씬 스코프 및 부모-자식 계층 단위 오브젝트 구성 패턴을 검증한다.

export function validateObjectPairing(gdf) {
  const errors = [];

  for (const scene of gdf.scenes) {
    const childrenMap = buildChildrenMap(scene.gameObjects);

    // ── 씬 스코프: Canvas ↔ EventSystem (exactly-1) ────────────────────────
    const hasCanvas    = scene.gameObjects.some(o => hasComp(o, "Canvas"));
    const eventSystems = scene.gameObjects.filter(o => hasComp(o, "EventSystem"));

    if (hasCanvas) {
      if (eventSystems.length === 0) {
        errors.push({
          code:     "GDS_G08",
          severity: "error",
          path:     `scenes[${scene.scene_name}]`,
          message:  `씬에 Canvas가 존재하나 EventSystem 오브젝트가 없다.`
        });
      } else if (eventSystems.length > 1) {
        errors.push({
          code:     "GDS_G08",
          severity: "error",
          path:     `scenes[${scene.scene_name}]`,
          message:  `씬에 EventSystem 오브젝트가 ${eventSystems.length}개 존재한다. 정확히 1개여야 한다.`
        });
      }
    }

    // ── 부모-자식 페어링 ───────────────────────────────────────────────────
    for (const obj of scene.gameObjects) {
      const children = childrenMap.get(obj.uid) ?? [];

      // Button → Text 또는 TextMeshProUGUI 직계 자식 1개 이상
      if (hasComp(obj, "Button")) {
        const hasTextChild = children.some(
          c => hasComp(c, "Text") || hasComp(c, "TextMeshProUGUI")
        );
        if (!hasTextChild) {
          errors.push({
            code:     "GDS_G08",
            severity: "error",
            path:     `scenes[${scene.scene_name}].gameObjects[${obj.uid}]`,
            message:  `Button "${obj.uid}"에 Text 또는 TextMeshProUGUI 직계 자식이 없다.`
          });
        }
      }

      // ScrollRect → Mask 보유 직계 자식(Viewport) + 그 자식에 Content 오브젝트
      if (hasComp(obj, "ScrollRect")) {
        const viewport = children.find(c => hasComp(c, "Mask"));
        if (!viewport) {
          errors.push({
            code:     "GDS_G08",
            severity: "error",
            path:     `scenes[${scene.scene_name}].gameObjects[${obj.uid}]`,
            message:  `ScrollRect "${obj.uid}"에 Mask 컴포넌트를 보유한 Viewport 직계 자식이 없다.`
          });
        } else {
          const viewportChildren = childrenMap.get(viewport.uid) ?? [];
          const content = viewportChildren.find(c => c.name === "Content");
          if (!content) {
            errors.push({
              code:     "GDS_G08",
              severity: "error",
              path:     `scenes[${scene.scene_name}].gameObjects[${viewport.uid}]`,
              message:  `ScrollRect "${obj.uid}"의 Viewport 자식에 "Content" 오브젝트가 없다.`
            });
          }
        }
      }

      // InputField → Text 또는 TextMeshProUGUI 직계 자식 2개 이상
      if (hasComp(obj, "InputField")) {
        const textChildren = children.filter(
          c => hasComp(c, "Text") || hasComp(c, "TextMeshProUGUI")
        );
        if (textChildren.length < 2) {
          errors.push({
            code:     "GDS_G08",
            severity: "error",
            path:     `scenes[${scene.scene_name}].gameObjects[${obj.uid}]`,
            message:  `InputField "${obj.uid}"에 Text/TextMeshProUGUI 직계 자식이 ${textChildren.length}개뿐이다. 입력값 표시용과 Placeholder용으로 2개 이상 필요.`
          });
        }
      }
    }
  }

  return errors;
}

function hasComp(obj, compName) {
  return obj.components.some(c => c.name === compName);
}

function buildChildrenMap(gameObjects) {
  const map = new Map(gameObjects.map(o => [o.uid, []]));
  for (const obj of gameObjects) {
    if (obj.parent_uid && map.has(obj.parent_uid)) {
      map.get(obj.parent_uid).push(obj);
    }
  }
  return map;
}
