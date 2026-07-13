using System;
using System.Collections.Generic;
using System.Reflection;
using Newtonsoft.Json.Linq;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace D2D.Editor
{
    public static class ComponentBinder
    {
        private static readonly Dictionary<string, Type> _knownTypes = new Dictionary<string, Type>
        {
            ["Camera"]           = typeof(Camera),
            ["Light"]            = typeof(Light),
            ["MeshRenderer"]     = typeof(MeshRenderer),
            ["MeshFilter"]       = typeof(MeshFilter),
            ["Rigidbody"]        = typeof(Rigidbody),
            ["Collider"]         = typeof(Collider),
            ["BoxCollider"]      = typeof(BoxCollider),
            ["SphereCollider"]   = typeof(SphereCollider),
            ["CapsuleCollider"]  = typeof(CapsuleCollider),
            ["CharacterController"] = typeof(CharacterController),
            ["AudioSource"]      = typeof(AudioSource),
            ["ParticleSystem"]   = typeof(ParticleSystem),
            ["AudioListener"]    = typeof(AudioListener),
            ["Canvas"]           = typeof(Canvas),
            ["CanvasScaler"]     = typeof(CanvasScaler),
            ["GraphicRaycaster"] = typeof(GraphicRaycaster),
            ["Button"]           = typeof(Button),
            ["Image"]            = typeof(Image),
            ["Text"]             = typeof(Text),
            ["RawImage"]         = typeof(RawImage),
            ["Toggle"]           = typeof(Toggle),
            ["Slider"]           = typeof(Slider),
            ["ScrollRect"]       = typeof(ScrollRect),
            ["TextMeshProUGUI"]      = typeof(TextMeshProUGUI),
            ["TextMeshPro"]          = typeof(TextMeshPro),
            ["EventSystem"]          = typeof(EventSystem),
            ["StandaloneInputModule"] = typeof(StandaloneInputModule),
        };

        public static void BindAll(List<GdfGameObject> goData, Dictionary<string, GameObject> goMap)
        {
            // 1패스: 모든 GO에 컴포넌트 부착 + 비참조 프로퍼티 주입
            foreach (var data in goData)
            {
                if (!goMap.TryGetValue(data.uid, out GameObject go)) continue;
                if (data.components == null) continue;

                foreach (var comp in data.components)
                    AttachComponent(go, comp);
            }

            // 2패스: '@uid' 참조 주입 (모든 컴포넌트가 부착된 후)
            foreach (var data in goData)
            {
                if (!goMap.TryGetValue(data.uid, out GameObject go)) continue;
                if (data.components == null) continue;

                foreach (var comp in data.components)
                    InjectReferences(go, comp, goMap);
            }
        }

        // 1패스: 컴포넌트 부착 + 비참조 프로퍼티만 주입
        private static void AttachComponent(GameObject go, GdfComponent compData)
        {
            Type type = ResolveType(compData.name, compData.isCustomScript);
            if (type == null)
            {
                Debug.LogWarning($"[D2D] 컴포넌트 타입 미발견: {compData.name}");
                return;
            }

            // MeshRenderer는 MeshFilter 없이는 메쉬가 안 보이므로 함께 추가
            if (type == typeof(MeshRenderer) && go.GetComponent<MeshFilter>() == null)
                go.AddComponent<MeshFilter>().sharedMesh = AssetResolver.ResolveMesh(null);

            Component comp;
            try
            {
                Component existing = go.GetComponent(type);
                comp = existing != null ? existing : go.AddComponent(type);
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[D2D] AddComponent 예외 — {compData.name} on {go.name}: {e.GetType().Name}: {e.Message}");
                return;
            }

            if (comp == null)
            {
                Debug.LogWarning($"[D2D] AddComponent null 반환 — {compData.name} on {go.name} (type={type.FullName})");
                return;
            }

            if (compData.properties == null) return;

            foreach (var kvp in compData.properties)
            {
                if (HasRefValue(kvp.Value)) continue;
                InjectProperty(comp, type, kvp.Key, kvp.Value, null);
            }
        }

        // 2패스: '@uid' 참조 프로퍼티만 주입
        private static void InjectReferences(GameObject go, GdfComponent compData, Dictionary<string, GameObject> goMap)
        {
            if (compData.properties == null) return;

            bool hasRef = false;
            foreach (var kvp in compData.properties)
                if (HasRefValue(kvp.Value)) { hasRef = true; break; }
            if (!hasRef) return;

            Type type = ResolveType(compData.name, compData.isCustomScript);
            if (type == null) return;

            Component comp = go.GetComponent(type);
            if (comp == null) return;

            foreach (var kvp in compData.properties)
            {
                if (!HasRefValue(kvp.Value)) continue;
                InjectProperty(comp, type, kvp.Key, kvp.Value, goMap);
            }
        }

        private static void InjectProperty(Component comp, Type type, string key, object value, Dictionary<string, GameObject> goMap)
        {
            try
            {
                // MeshRenderer 특수 처리 (URP 대응)
                if (comp is MeshRenderer renderer)
                {
                    if (key == "shaderName")
                    {
                        // URP 프로젝트에서 Standard 셰이더는 핑크로 렌더되므로 URP/Lit으로 강제 교체
                        string shaderName = value.ToString();
                        Shader shader = Shader.Find("Universal Render Pipeline/Lit");
                        if (shader == null)
                            shader = Shader.Find(shaderName);
                        if (shader == null)
                            Debug.LogWarning($"[D2D] Shader 미발견: {shaderName}");
                        else
                        {
                            Color? previousColor = ReadMaterialColor(renderer.sharedMaterial);
                            renderer.sharedMaterial = new Material(shader);
                            if (previousColor.HasValue)
                                SetMaterialColor(renderer.sharedMaterial, previousColor.Value);
                        }
                        return;
                    }
                    if (key == "materialColor")
                    {
                        ApplyMaterialColor(renderer, value);
                        return;
                    }
                    if (key == "renderingMode" || key == "alpha" || key == "surface")
                    {
                        Debug.LogWarning($"[D2D] URP에서 미지원 MeshRenderer 프로퍼티 스킵: {key}");
                        return;
                    }
                }

                if (comp is ParticleSystem particleSystem && TryInjectParticleSystemProperty(particleSystem, key, value))
                    return;

                PropertyInfo prop = type.GetProperty(key, BindingFlags.Public | BindingFlags.Instance);
                FieldInfo field = null;
                if (prop == null)
                    field = type.GetField(key, BindingFlags.Public | BindingFlags.Instance);

                if (prop == null && field == null)
                {
                    Debug.LogWarning($"[D2D] 프로퍼티/필드 미발견: {type.Name}.{key}");
                    return;
                }

                Type targetType = prop != null ? prop.PropertyType : field.FieldType;
                object converted = ConvertValue(value, targetType, goMap);

                if (converted == null && targetType.IsValueType)
                {
                    Debug.LogWarning($"[D2D] 타입 변환 실패 스킵: {type.Name}.{key}");
                    return;
                }

                if (prop != null)
                    prop.SetValue(comp, converted);
                else
                    field.SetValue(comp, converted);
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[D2D] 프로퍼티 주입 실패 스킵: {type.Name}.{key} — {e.Message}");
            }
        }

        private static void ApplyMaterialColor(MeshRenderer renderer, object value)
        {
            object converted = ConvertValue(value, typeof(Color), null);
            if (!(converted is Color color))
            {
                Debug.LogWarning($"[D2D] 타입 변환 실패 스킵: MeshRenderer.materialColor");
                return;
            }

            if (renderer.sharedMaterial == null)
            {
                Shader shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
                if (shader == null)
                {
                    Debug.LogWarning("[D2D] materialColor 적용 실패: 사용 가능한 Shader 없음");
                    return;
                }
                renderer.sharedMaterial = new Material(shader);
            }

            SetMaterialColor(renderer.sharedMaterial, color);
        }

        private static Color? ReadMaterialColor(Material material)
        {
            if (material == null)
                return null;
            if (material.HasProperty("_BaseColor"))
                return material.GetColor("_BaseColor");
            if (material.HasProperty("_Color"))
                return material.color;
            return null;
        }

        private static void SetMaterialColor(Material material, Color color)
        {
            if (material.HasProperty("_BaseColor"))
                material.SetColor("_BaseColor", color);
            else
                material.color = color;
        }

        private static bool TryInjectParticleSystemProperty(ParticleSystem particleSystem, string key, object value)
        {
            var main = particleSystem.main;
            switch (key)
            {
                case "duration":
                    main.duration = Convert.ToSingle(value);
                    return true;
                case "loop":
                    main.loop = Convert.ToBoolean(value);
                    return true;
                case "startLifetime":
                    main.startLifetime = Convert.ToSingle(value);
                    return true;
                case "startSpeed":
                    main.startSpeed = Convert.ToSingle(value);
                    return true;
                case "startSize":
                    main.startSize = Convert.ToSingle(value);
                    return true;
                case "startColor":
                    object converted = ConvertValue(value, typeof(Color), null);
                    if (converted is Color color)
                    {
                        main.startColor = color;
                        return true;
                    }
                    Debug.LogWarning("[D2D] 타입 변환 실패 스킵: ParticleSystem.startColor");
                    return true;
                case "maxParticles":
                    main.maxParticles = Convert.ToInt32(value);
                    return true;
                case "emissionRate":
                    var emission = particleSystem.emission;
                    emission.rateOverTime = Convert.ToSingle(value);
                    return true;
                default:
                    return false;
            }
        }

        private static object ConvertValue(object value, Type targetType, Dictionary<string, GameObject> goMap)
        {
            if (value == null) return null;

            // '@uid' → GameObject 또는 Component 참조
            if (value is string refStr && refStr.StartsWith("@"))
            {
                string uid = refStr.Substring(1);
                if (!goMap.TryGetValue(uid, out GameObject refGo))
                {
                    Debug.LogWarning($"[D2D] GameObject 참조 미발견: {refStr}");
                    return null;
                }
                if (targetType == typeof(GameObject))
                    return refGo;
                if (typeof(Component).IsAssignableFrom(targetType))
                {
                    Component refComp = refGo.GetComponent(targetType);
                    if (refComp == null)
                        Debug.LogWarning($"[D2D] 참조 대상에서 컴포넌트 미발견: {refStr} → {targetType.Name}");
                    return refComp;
                }
                Debug.LogWarning($"[D2D] '@' 참조이지만 대상 타입이 GameObject/Component가 아님: {targetType.Name}");
                return null;
            }

            // 'prefab:Name' → 프리팹 에셋 참조
            if (value is string prefabStr && prefabStr.StartsWith("prefab:"))
            {
                string prefabName = prefabStr.Substring("prefab:".Length);
                if (targetType == typeof(GameObject))
                    return AssetResolver.ResolvePrefab(prefabName);
                if (typeof(Component).IsAssignableFrom(targetType))
                {
                    GameObject prefabGo = AssetResolver.ResolvePrefab(prefabName);
                    if (prefabGo == null) return null;
                    Component prefabComp = prefabGo.GetComponent(targetType);
                    if (prefabComp == null)
                        Debug.LogWarning($"[D2D] Prefab '{prefabName}'에서 컴포넌트 미발견: {targetType.Name}");
                    return prefabComp;
                }
                Debug.LogWarning($"[D2D] 'prefab:' 참조이지만 대상 타입이 GameObject/Component가 아님: {targetType.Name}");
                return null;
            }

            // AudioClip / Sprite 에셋 참조
            if (targetType == typeof(AudioClip))
            {
                AudioClip clip = AssetResolver.ResolveAudio(value.ToString());
                return clip;
            }
            if (targetType == typeof(Sprite))
            {
                Sprite sprite = AssetResolver.ResolveSprite(value.ToString());
                return sprite;
            }

            if (targetType == typeof(Mesh))
                return AssetResolver.ResolveMesh(value.ToString());

            // JArray → T[] 또는 List<T> (배열 @uid 주입 포함)
            if (value is JArray jArr)
            {
                if (targetType.IsArray)
                {
                    Type elemType = targetType.GetElementType();
                    Array result = Array.CreateInstance(elemType, jArr.Count);
                    for (int i = 0; i < jArr.Count; i++)
                    {
                        object raw = jArr[i] is JValue jv0 ? jv0.Value : (object)jArr[i];
                        result.SetValue(ConvertValue(raw, elemType, goMap), i);
                    }
                    return result;
                }
                if (targetType.IsGenericType && targetType.GetGenericTypeDefinition() == typeof(List<>))
                {
                    Type elemType = targetType.GetGenericArguments()[0];
                    var list = (System.Collections.IList)Activator.CreateInstance(targetType);
                    foreach (var item in jArr)
                    {
                        object raw = item is JValue jv1 ? jv1.Value : (object)item;
                        list.Add(ConvertValue(raw, elemType, goMap));
                    }
                    return list;
                }
            }

            // JArray → Vector3
            if (targetType == typeof(Vector3) && value is JArray arr3 && arr3.Count >= 3)
                return new Vector3((float)arr3[0], (float)arr3[1], (float)arr3[2]);

            // JArray → Vector2
            if (targetType == typeof(Vector2) && value is JArray arr2 && arr2.Count >= 2)
                return new Vector2((float)arr2[0], (float)arr2[1]);

            // Color from "#RRGGBB"
            if (targetType == typeof(Color) && value is string colorStr && colorStr.StartsWith("#"))
            {
                if (ColorUtility.TryParseHtmlString(colorStr, out Color c))
                    return c;
                return null;
            }

            // Color from [r, g, b, a] JArray
            if (targetType == typeof(Color) && value is JArray arrColor && arrColor.Count >= 4)
                return new Color((float)arrColor[0], (float)arrColor[1], (float)arrColor[2], (float)arrColor[3]);

            // Enum from string
            if (targetType.IsEnum && value is string enumStr)
                return Enum.Parse(targetType, enumStr);

            // Primitive conversion (long/double → float/int/etc.)
            return Convert.ChangeType(value, targetType);
        }

        private static bool HasRefValue(object value)
        {
            if (value is string s) return s.StartsWith("@");
            if (value is JArray arr)
                foreach (var item in arr)
                    if (item is JValue jv && jv.Value is string vs && vs.StartsWith("@")) return true;
            return false;
        }

        private static Type ResolveType(string name, bool isCustomScript)
        {
            if (_knownTypes.TryGetValue(name, out Type known))
                return known;

            Type direct = Type.GetType(name);
            if (direct != null) return direct;

            // 클래스 단순명(Name)으로 전체 어셈블리 순회
            // isCustomScript=true면 MonoBehaviour 파생 타입만 허용하여 Unity 내부 동명 클래스와 충돌 방지
            foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
            {
                foreach (var t in assembly.GetTypes())
                {
                    if (t.Name != name) continue;
                    if (isCustomScript && !t.IsSubclassOf(typeof(MonoBehaviour))) continue;
                    return t;
                }
            }

            return null;
        }
    }
}
