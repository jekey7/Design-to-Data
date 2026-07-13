using System;
using System.Collections.Generic;
using System.Reflection;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace D2D.Editor
{
    public static class ComponentExtractor
    {
        public static List<GdfComponent> Extract(GameObject go, Dictionary<GameObject, string> uidMap = null)
        {
            var result = new List<GdfComponent>();

            foreach (var comp in go.GetComponents<Component>())
            {
                if (comp == null) continue;

                // Transform / RectTransform은 GDF 구조상 별도 필드이므로 제외
                // CanvasRenderer, UniversalAdditionalLightData는 Unity/URP 내부 컴포넌트로 GDF 스펙 범위 외
                if (comp is Transform) continue;
                if (comp is CanvasRenderer) continue;
                if (comp.GetType().Name == "UniversalAdditionalLightData") continue;

                var gdfComp = TryExtractBuiltin(comp, uidMap);
                if (gdfComp != null)
                {
                    result.Add(gdfComp);
                    continue;
                }

                // 빌트인 화이트리스트에 없는 MonoBehaviour → 커스텀 스크립트로 취급
                if (comp is MonoBehaviour mb)
                {
                    result.Add(ExtractCustomScript(mb));
                }
                else
                {
                    // 알 수 없는 빌트인 컴포넌트 — 이름만 기록
                    Debug.LogWarning($"[D2D] 화이트리스트 미등록 빌트인 컴포넌트: {comp.GetType().Name} (GO: {go.name})");
                    result.Add(new GdfComponent
                    {
                        name           = comp.GetType().Name,
                        isCustomScript = false,
                        properties     = new Dictionary<string, object>()
                    });
                }
            }

            return result;
        }

        // ──────────────────────────────────────────────
        // 빌트인 화이트리스트
        // ──────────────────────────────────────────────

        private static GdfComponent TryExtractBuiltin(Component comp, Dictionary<GameObject, string> uidMap)
        {
            switch (comp)
            {
                case Camera c:
                    return Make("Camera", false, new Dictionary<string, object>
                    {
                        { "fieldOfView",      (object)(float)c.fieldOfView },
                        { "clearFlags",       c.clearFlags.ToString() },
                        { "backgroundColor",  ColorToHex(c.backgroundColor) }
                    });

                case AudioListener _:
                    return Make("AudioListener", false, new Dictionary<string, object>());

                case AudioSource a:
                {
                    var props = new Dictionary<string, object>
                    {
                        { "volume",      (object)a.volume },
                        { "loop",        (object)a.loop },
                        { "playOnAwake", (object)a.playOnAwake }
                    };
                    if (a.clip != null)
                        props["clip"] = a.clip.name;
                    return Make("AudioSource", false, props);
                }

                case MeshFilter meshFilter:
                    return Make("MeshFilter", false, new Dictionary<string, object>
                    {
                        { "mesh", meshFilter.sharedMesh != null ? meshFilter.sharedMesh.name : "Cube" }
                    });

                case MeshRenderer meshRenderer:
                    return Make("MeshRenderer", false, new Dictionary<string, object>
                    {
                        { "shaderName", meshRenderer.sharedMaterial != null && meshRenderer.sharedMaterial.shader != null
                            ? meshRenderer.sharedMaterial.shader.name
                            : "Universal Render Pipeline/Lit" }
                    });

                case Light l:
                    return Make("Light", false, new Dictionary<string, object>
                    {
                        { "type",      l.type.ToString() },
                        { "intensity", (object)l.intensity }
                    });

                case Canvas cv:
                    return Make("Canvas", false, new Dictionary<string, object>
                    {
                        { "renderMode",   cv.renderMode.ToString() },
                        { "sortingOrder", (object)cv.sortingOrder }
                    });

                case CanvasScaler cs:
                    return Make("CanvasScaler", false, new Dictionary<string, object>
                    {
                        { "uiScaleMode",         cs.uiScaleMode.ToString() },
                        { "referenceResolution",  new float[] { cs.referenceResolution.x, cs.referenceResolution.y } },
                        { "screenMatchMode",      cs.screenMatchMode.ToString() },
                        { "matchWidthOrHeight",   (object)cs.matchWidthOrHeight }
                    });

                case GraphicRaycaster _:
                    return Make("GraphicRaycaster", false, new Dictionary<string, object>());

                case Image img:
                {
                    var props = new Dictionary<string, object>
                    {
                        { "color",         ColorToHex(img.color) },
                        { "raycastTarget", (object)img.raycastTarget }
                    };
                    if (img.sprite != null)
                        props["sprite"] = img.sprite.name;
                    return Make("Image", false, props);
                }

                case Button btn:
                    return ExtractButton(btn, uidMap);

                case TextMeshProUGUI tmp:
                    return Make("TextMeshProUGUI", false, new Dictionary<string, object>
                    {
                        { "text",               (object)tmp.text },
                        { "fontSize",           (object)(float)tmp.fontSize },
                        { "color",              ColorToHex(tmp.color) },
                        { "alignment",          tmp.alignment.ToString() },
                        { "fontStyle",          tmp.fontStyle.ToString() },
                        { "textWrappingMode",   tmp.textWrappingMode.ToString() },
                        { "raycastTarget",      (object)tmp.raycastTarget }
                    });

                case Text t:
                    return Make("Text", false, new Dictionary<string, object>
                    {
                        { "text",     (object)t.text },
                        { "fontSize", (object)t.fontSize },
                        { "color",    ColorToHex(t.color) }
                    });

                case CanvasGroup cg:
                    return Make("CanvasGroup", false, new Dictionary<string, object>
                    {
                        { "alpha",           (object)cg.alpha },
                        { "interactable",    (object)cg.interactable },
                        { "blocksRaycasts",  (object)cg.blocksRaycasts }
                    });

                default:
                    return null;
            }
        }

        private static GdfComponent ExtractButton(Button btn, Dictionary<GameObject, string> uidMap)
        {
            var comp = Make("Button", false, new Dictionary<string, object>
            {
                { "interactable", (object)btn.interactable }
            });

            // 직렬화된 영구 이벤트만 추출
            int count = btn.onClick.GetPersistentEventCount();
            if (count > 0)
            {
                var bindings = new List<GdfEventBinding>();
                bool hasRuntimeBinding = false;

                for (int i = 0; i < count; i++)
                {
                    var target = btn.onClick.GetPersistentTarget(i);
                    var method = btn.onClick.GetPersistentMethodName(i);

                    if (target == null || string.IsNullOrEmpty(method))
                    {
                        hasRuntimeBinding = true;
                        continue;
                    }

                    GameObject targetGo = null;
                    if (target is GameObject go)
                        targetGo = go;
                    else if (target is Component c)
                        targetGo = c.gameObject;

                    if (targetGo == null)
                    {
                        hasRuntimeBinding = true;
                        continue;
                    }

                    // uidMap이 있으면 정규화된 uid 사용, 없으면 go.name 그대로
                    string resolvedUid = (uidMap != null && uidMap.TryGetValue(targetGo, out var mappedUid))
                        ? mappedUid
                        : targetGo.name;
                    string targetUid = "@" + resolvedUid;

                    bindings.Add(new GdfEventBinding
                    {
                        target_uid = targetUid,
                        component  = target is Component targetAsComp ? targetAsComp.GetType().Name : "",
                        method     = method,
                        param      = null
                    });
                }

                if (bindings.Count > 0)
                {
                    comp.events = new Dictionary<string, List<GdfEventBinding>>
                    {
                        { "onClick", bindings }
                    };
                }

                if (hasRuntimeBinding)
                {
                    // D-3: 런타임 이벤트 감지 메타 필드 기록
                    if (comp.properties == null)
                        comp.properties = new Dictionary<string, object>();
                    comp.properties["_runtimeEventDetected"] = true;
                    Debug.LogWarning($"[D2D] 런타임 이벤트 감지 (추출 불가): {btn.gameObject.name}");
                }
            }

            return comp;
        }

        // ──────────────────────────────────────────────
        // 커스텀 스크립트 Reflection 추출
        // ──────────────────────────────────────────────

        private static GdfComponent ExtractCustomScript(MonoBehaviour mb)
        {
            var props = new Dictionary<string, object>();
            var type  = mb.GetType();

            // public 인스턴스 필드
            foreach (var field in type.GetFields(BindingFlags.Public | BindingFlags.Instance))
            {
                if (field.IsStatic) continue;
                var val = field.GetValue(mb);
                var converted = ConvertValue(val);
                if (converted != null)
                    props[field.Name] = converted;
            }

            // [SerializeField] 비공개 필드
            foreach (var field in type.GetFields(BindingFlags.NonPublic | BindingFlags.Instance))
            {
                if (field.GetCustomAttribute<SerializeField>() == null) continue;
                var val = field.GetValue(mb);
                var converted = ConvertValue(val);
                if (converted != null)
                    props[field.Name] = converted;
            }

            return Make(type.Name, true, props);
        }

        // Unity 직렬화 타입 → JSON 호환 타입으로 변환
        // null 반환 시 해당 필드는 properties에서 제외
        private static object ConvertValue(object val)
        {
            if (val == null) return null;

            // UnityEngine.Object는 C# null 체크를 통과해도 미할당 상태일 수 있으므로
            // Unity bool 연산자로 추가 검사 (UnassignedReferenceException 방지)
            if (val is UnityEngine.Object unityObj && !unityObj)
                return null;

            switch (val)
            {
                case string s:   return s;
                case bool b:     return b;
                case int i:      return i;
                case float f:    return f;
                case double d:   return d;
                case Vector2 v2: return new float[] { v2.x, v2.y };
                case Vector3 v3: return new float[] { v3.x, v3.y, v3.z };
                case Color col:  return ColorToHex(col);
                case Enum e:     return e.ToString();

                case AudioClip ac:
                    return ac.name;
                case Sprite sp:
                    return sp.name;

                // GameObject / Component 참조 — GO name 기반 uid 참조로 변환
                case GameObject go:
                    return "@" + go.name;
                case Component comp:
                    return "@" + comp.gameObject.name;

                default:
                    return null;
            }
        }

        // ──────────────────────────────────────────────
        // 헬퍼
        // ──────────────────────────────────────────────

        private static GdfComponent Make(string name, bool isCustomScript, Dictionary<string, object> props)
        {
            return new GdfComponent
            {
                name           = name,
                isCustomScript = isCustomScript,
                properties     = props
            };
        }

        private static string ColorToHex(Color c)
        {
            return $"#{Mathf.RoundToInt(c.r * 255):X2}{Mathf.RoundToInt(c.g * 255):X2}{Mathf.RoundToInt(c.b * 255):X2}";
        }
    }
}

