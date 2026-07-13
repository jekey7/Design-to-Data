using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace D2D.Editor
{
    public static class PrefabBuilder
    {
        private const string PrefabSavePath = "Assets/D2D/Prefabs";

        public static void BuildAll(List<GdfScene> scenes)
        {
            string fullDir = Path.Combine(Application.dataPath, "D2D", "Prefabs");
            Directory.CreateDirectory(fullDir);

            foreach (var scene in scenes)
            {
                if (scene.prefabs == null || scene.prefabs.Count == 0) continue;
                foreach (var prefabData in scene.prefabs)
                    BuildOnePrefab(prefabData);
            }
        }

        private static void BuildOnePrefab(GdfPrefab data)
        {
            if (string.IsNullOrEmpty(data.name))
            {
                Debug.LogWarning("[D2D] 프리팹 name이 비어있어 스킵합니다.");
                return;
            }

            string assetPath = $"{PrefabSavePath}/{data.name}.prefab";
            GameObject go = null;

            try
            {
                go = new GameObject(data.name);
                SetTag(go, data.tag);
                SetLayer(go, data.layer);

                if (data.gdfTransform != null)
                    ApplyTransform(go, data.gdfTransform);

                if (data.components != null && data.components.Count > 0)
                {
                    var goData = ToGameObjectData(data);
                    var goMap = new Dictionary<string, GameObject> { [data.uid ?? data.name] = go };
                    ComponentBinder.BindAll(new List<GdfGameObject> { goData }, goMap);
                }

                GameObject saved = PrefabUtility.SaveAsPrefabAsset(go, assetPath);
                if (saved != null)
                    Debug.Log($"[D2D] 프리팹 저장 완료: {assetPath}");
                else
                    Debug.LogWarning($"[D2D] 프리팹 저장 실패 (null 반환): {assetPath}");
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[D2D] 프리팹 저장 예외 스킵: {data.name} — {e.Message}");
            }
            finally
            {
                if (go != null)
                    UnityEngine.Object.DestroyImmediate(go);
            }
        }

        private static GdfGameObject ToGameObjectData(GdfPrefab p) => new GdfGameObject
        {
            uid = p.uid ?? p.name,
            name = p.name,
            tag = p.tag,
            layer = p.layer,
            parent_uid = null,
            gdfTransform = p.gdfTransform,
            rectTransform = p.rectTransform,
            components = p.components
        };

        private static void SetTag(GameObject go, string tag)
        {
            if (string.IsNullOrEmpty(tag)) return;
            try { go.tag = tag; }
            catch (UnityException)
            {
                Debug.LogWarning($"[D2D] 미등록 태그: {tag}, Untagged로 대체");
                go.tag = "Untagged";
            }
        }

        private static void SetLayer(GameObject go, string layerName)
        {
            if (string.IsNullOrEmpty(layerName)) return;
            int layer = LayerMask.NameToLayer(layerName);
            if (layer == -1)
            {
                Debug.LogWarning($"[D2D] 미등록 레이어: {layerName}, Default(0)으로 대체");
                go.layer = 0;
            }
            else
            {
                go.layer = layer;
            }
        }

        private static void ApplyTransform(GameObject go, GdfTransform t)
        {
            if (t.position != null && t.position.Length >= 3)
                go.transform.localPosition = new Vector3(t.position[0], t.position[1], t.position[2]);
            if (t.rotation != null && t.rotation.Length >= 3)
                go.transform.localEulerAngles = new Vector3(t.rotation[0], t.rotation[1], t.rotation[2]);
            if (t.scale != null && t.scale.Length >= 3)
                go.transform.localScale = new Vector3(t.scale[0], t.scale[1], t.scale[2]);
        }
    }
}
