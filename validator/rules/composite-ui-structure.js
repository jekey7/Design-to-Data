// rules/composite-ui-structure.js
// RULE-G09 — 복합 UI 컴포넌트 표준 자식 구조
// Slider, Toggle, Dropdown, Scrollbar의 표준 자식 계층이 갖춰져 있는지 검증한다.

export function validateCompositeUIStructure(gdf) {
  const errors = [];

  for (const scene of gdf.scenes) {
    const childrenMap = buildChildrenMap(scene.gameObjects);
    const objMap      = new Map(scene.gameObjects.map(o => [o.uid, o]));

    for (const obj of scene.gameObjects) {
      const p = `scenes[${scene.scene_name}].gameObjects[${obj.uid}]`;

      // ── Slider ────────────────────────────────────────────────────────────
      if (hasComp(obj, "Slider")) {
        const children = childrenMap.get(obj.uid) ?? [];

        // 직계 자식: Background (Image)
        const bg = children.find(c => c.name === "Background");
        if (!bg || !hasComp(bg, "Image")) {
          errors.push({ code: "GDS_G09", severity: "error", path: p,
            message: `Slider "${obj.uid}": Image 컴포넌트를 보유한 "Background" 직계 자식이 없다.` });
        }

        // 직계 자식: Fill Area → 자식 Fill (Image)
        const fillArea = children.find(c => c.name === "Fill Area");
        if (!fillArea) {
          errors.push({ code: "GDS_G09", severity: "error", path: p,
            message: `Slider "${obj.uid}": "Fill Area" 직계 자식이 없다.` });
        } else {
          const fill = findChildByName(fillArea.uid, "Fill", childrenMap);
          if (!fill || !hasComp(fill, "Image")) {
            errors.push({ code: "GDS_G09", severity: "error",
              path: `scenes[${scene.scene_name}].gameObjects[${fillArea.uid}]`,
              message: `Slider "${obj.uid}": Fill Area 하위에 Image 컴포넌트를 보유한 "Fill" 자식이 없다.` });
          }
        }

        // 직계 자식: Handle Slide Area → 자식 Handle (Image)
        const handleSlideArea = children.find(c => c.name === "Handle Slide Area");
        if (!handleSlideArea) {
          errors.push({ code: "GDS_G09", severity: "error", path: p,
            message: `Slider "${obj.uid}": "Handle Slide Area" 직계 자식이 없다.` });
        } else {
          const handle = findChildByName(handleSlideArea.uid, "Handle", childrenMap);
          if (!handle || !hasComp(handle, "Image")) {
            errors.push({ code: "GDS_G09", severity: "error",
              path: `scenes[${scene.scene_name}].gameObjects[${handleSlideArea.uid}]`,
              message: `Slider "${obj.uid}": Handle Slide Area 하위에 Image 컴포넌트를 보유한 "Handle" 자식이 없다.` });
          }
        }
      }

      // ── Toggle ────────────────────────────────────────────────────────────
      // Dropdown Item으로 사용되는 Toggle은 내부 구조가 다르므로 건너뛴다.
      if (hasComp(obj, "Toggle") && !isDropdownItem(obj, objMap)) {
        const children = childrenMap.get(obj.uid) ?? [];

        // 직계 자식: Background (Image) → 자식 Checkmark (Image)
        const bg = children.find(c => c.name === "Background");
        if (!bg || !hasComp(bg, "Image")) {
          errors.push({ code: "GDS_G09", severity: "error", path: p,
            message: `Toggle "${obj.uid}": Image 컴포넌트를 보유한 "Background" 직계 자식이 없다.` });
        } else {
          const checkmark = findChildByName(bg.uid, "Checkmark", childrenMap);
          if (!checkmark || !hasComp(checkmark, "Image")) {
            errors.push({ code: "GDS_G09", severity: "error",
              path: `scenes[${scene.scene_name}].gameObjects[${bg.uid}]`,
              message: `Toggle "${obj.uid}": Background 하위에 Image 컴포넌트를 보유한 "Checkmark" 자식이 없다.` });
          }
        }

        // 직계 자식: Label (Text 또는 TextMeshProUGUI)
        const label = children.find(c => c.name === "Label");
        if (!label || (!hasComp(label, "Text") && !hasComp(label, "TextMeshProUGUI"))) {
          errors.push({ code: "GDS_G09", severity: "error", path: p,
            message: `Toggle "${obj.uid}": Text 또는 TextMeshProUGUI 컴포넌트를 보유한 "Label" 직계 자식이 없다.` });
        }
      }

      // ── Dropdown ──────────────────────────────────────────────────────────
      if (hasComp(obj, "Dropdown") || hasComp(obj, "TMP_Dropdown")) {
        const children = childrenMap.get(obj.uid) ?? [];

        // 직계 자식: Label (Text 또는 TextMeshProUGUI)
        const label = children.find(c => c.name === "Label");
        if (!label || (!hasComp(label, "Text") && !hasComp(label, "TextMeshProUGUI"))) {
          errors.push({ code: "GDS_G09", severity: "error", path: p,
            message: `Dropdown "${obj.uid}": Text 또는 TextMeshProUGUI 컴포넌트를 보유한 "Label" 직계 자식이 없다.` });
        }

        // 직계 자식: Arrow (Image)
        const arrow = children.find(c => c.name === "Arrow");
        if (!arrow || !hasComp(arrow, "Image")) {
          errors.push({ code: "GDS_G09", severity: "error", path: p,
            message: `Dropdown "${obj.uid}": Image 컴포넌트를 보유한 "Arrow" 직계 자식이 없다.` });
        }

        // 직계 자식: Template (ScrollRect + CanvasGroup)
        const template = children.find(c => c.name === "Template");
        if (!template || !hasComp(template, "ScrollRect") || !hasComp(template, "CanvasGroup")) {
          errors.push({ code: "GDS_G09", severity: "error", path: p,
            message: `Dropdown "${obj.uid}": ScrollRect와 CanvasGroup 컴포넌트를 모두 보유한 "Template" 직계 자식이 없다.` });
        } else {
          // Template → Viewport (Mask + Image)
          const viewport = findChildByName(template.uid, "Viewport", childrenMap);
          if (!viewport || !hasComp(viewport, "Mask") || !hasComp(viewport, "Image")) {
            errors.push({ code: "GDS_G09", severity: "error",
              path: `scenes[${scene.scene_name}].gameObjects[${template.uid}]`,
              message: `Dropdown "${obj.uid}": Template 하위에 Mask와 Image 컴포넌트를 모두 보유한 "Viewport" 자식이 없다.` });
          } else {
            // Viewport → Content
            const content = findChildByName(viewport.uid, "Content", childrenMap);
            if (!content) {
              errors.push({ code: "GDS_G09", severity: "error",
                path: `scenes[${scene.scene_name}].gameObjects[${viewport.uid}]`,
                message: `Dropdown "${obj.uid}": Viewport 하위에 "Content" 자식이 없다.` });
            } else {
              // Content → Item (Toggle)
              const item = findChildByName(content.uid, "Item", childrenMap);
              if (!item || !hasComp(item, "Toggle")) {
                errors.push({ code: "GDS_G09", severity: "error",
                  path: `scenes[${scene.scene_name}].gameObjects[${content.uid}]`,
                  message: `Dropdown "${obj.uid}": Content 하위에 Toggle 컴포넌트를 보유한 "Item" 자식이 없다.` });
              } else {
                const itemChildren = childrenMap.get(item.uid) ?? [];

                // Item → Item Background (Image)
                const itemBg = itemChildren.find(c => c.name === "Item Background");
                if (!itemBg || !hasComp(itemBg, "Image")) {
                  errors.push({ code: "GDS_G09", severity: "error",
                    path: `scenes[${scene.scene_name}].gameObjects[${item.uid}]`,
                    message: `Dropdown "${obj.uid}": Item 하위에 Image 컴포넌트를 보유한 "Item Background" 자식이 없다.` });
                }

                // Item → Item Checkmark (Image)
                const itemCheckmark = itemChildren.find(c => c.name === "Item Checkmark");
                if (!itemCheckmark || !hasComp(itemCheckmark, "Image")) {
                  errors.push({ code: "GDS_G09", severity: "error",
                    path: `scenes[${scene.scene_name}].gameObjects[${item.uid}]`,
                    message: `Dropdown "${obj.uid}": Item 하위에 Image 컴포넌트를 보유한 "Item Checkmark" 자식이 없다.` });
                }

                // Item → Item Label (Text 또는 TextMeshProUGUI)
                const itemLabel = itemChildren.find(c => c.name === "Item Label");
                if (!itemLabel || (!hasComp(itemLabel, "Text") && !hasComp(itemLabel, "TextMeshProUGUI"))) {
                  errors.push({ code: "GDS_G09", severity: "error",
                    path: `scenes[${scene.scene_name}].gameObjects[${item.uid}]`,
                    message: `Dropdown "${obj.uid}": Item 하위에 Text 또는 TextMeshProUGUI 컴포넌트를 보유한 "Item Label" 자식이 없다.` });
                }
              }
            }
          }
        }
      }

      // ── Scrollbar ─────────────────────────────────────────────────────────
      if (hasComp(obj, "Scrollbar")) {
        const children = childrenMap.get(obj.uid) ?? [];

        // 직계 자식: Sliding Area → 자식 Handle (Image)
        const slidingArea = children.find(c => c.name === "Sliding Area");
        if (!slidingArea) {
          errors.push({ code: "GDS_G09", severity: "error", path: p,
            message: `Scrollbar "${obj.uid}": "Sliding Area" 직계 자식이 없다.` });
        } else {
          const handle = findChildByName(slidingArea.uid, "Handle", childrenMap);
          if (!handle || !hasComp(handle, "Image")) {
            errors.push({ code: "GDS_G09", severity: "error",
              path: `scenes[${scene.scene_name}].gameObjects[${slidingArea.uid}]`,
              message: `Scrollbar "${obj.uid}": Sliding Area 하위에 Image 컴포넌트를 보유한 "Handle" 자식이 없다.` });
          }
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

function findChildByName(parentUid, name, childrenMap) {
  const children = childrenMap.get(parentUid) ?? [];
  return children.find(c => c.name === name) ?? null;
}

// Dropdown Item으로 사용되는 Toggle인지 판별한다.
// 조상 체인을 올라가며 Dropdown 또는 TMP_Dropdown 컴포넌트를 보유한 오브젝트가 있으면 true.
function isDropdownItem(obj, objMap) {
  let current = obj.parent_uid ? objMap.get(obj.parent_uid) : null;
  const visited = new Set();
  while (current) {
    if (visited.has(current.uid)) break;
    visited.add(current.uid);
    if (hasComp(current, "Dropdown") || hasComp(current, "TMP_Dropdown")) return true;
    current = current.parent_uid ? objMap.get(current.parent_uid) : null;
  }
  return false;
}
