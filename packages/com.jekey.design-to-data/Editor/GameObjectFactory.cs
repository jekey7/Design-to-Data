using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace D2D.Editor
{
    public static class GameObjectFactory
    {
        public static Dictionary<string, GameObject> CreateAll(List<GdfGameObject> sorted, Scene scene)
        {
            var goMap = new Dictionary<string, GameObject>();

            foreach (var data in sorted)
            {
                // UI 오브젝트는 RectTransform이 기본 컴포넌트여야 함 — new GameObject()는 Transform만 생성하므로
                // DefaultControls 없이 RectTransform을 처음부터 갖도록 직접 생성
                var go = data.layer == "UI"
                    ? new GameObject(data.name, typeof(RectTransform))
                    : new GameObject(data.name);
                if (scene.IsValid())
                    SceneManager.MoveGameObjectToScene(go, scene);

                SetTag(go, data.tag);
                SetLayer(go, data.layer);

                if (!string.IsNullOrEmpty(data.parent_uid))
                {
                    if (goMap.TryGetValue(data.parent_uid, out GameObject parent))
                        go.transform.SetParent(parent.transform, false);
                    else
                        Debug.LogWarning($"[D2D] parent_uid 미발견: {data.parent_uid} (오브젝트: {data.name})");
                }

                if (data.layer != "UI" && data.gdfTransform != null)
                    ApplyTransform(go, data.gdfTransform);

                go.SetActive(data.active);

                goMap[data.uid] = go;
            }

            return goMap;
        }

        // Canvas 컴포넌트 부착 후 호출해야 RectTransform이 유효함
        public static void ApplyRectTransforms(List<GdfGameObject> sorted, Dictionary<string, GameObject> goMap)
        {
            foreach (var data in sorted)
            {
                if (data.layer != "UI") continue;
                if (!goMap.TryGetValue(data.uid, out GameObject go)) continue;
                ApplyRectTransform(go, data.rectTransform);
            }
        }

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

        private static void ApplyRectTransform(GameObject go, GdfRectTransform data)
        {
            if (data == null) return;

            var rt = go.GetComponent<RectTransform>();
            if (rt == null)
            {
                Debug.LogWarning($"[D2D] RectTransform 미발견 (UI 오브젝트 생성 오류): {go.name}");
                return;
            }

            if (data.anchoredPosition != null && data.anchoredPosition.Length >= 2)
                rt.anchoredPosition = new Vector2(data.anchoredPosition[0], data.anchoredPosition[1]);
            if (data.sizeDelta != null && data.sizeDelta.Length >= 2)
                rt.sizeDelta = new Vector2(data.sizeDelta[0], data.sizeDelta[1]);
            if (data.pivot != null && data.pivot.Length >= 2)
                rt.pivot = new Vector2(data.pivot[0], data.pivot[1]);
            if (data.anchorMin != null && data.anchorMin.Length >= 2)
                rt.anchorMin = new Vector2(data.anchorMin[0], data.anchorMin[1]);
            if (data.anchorMax != null && data.anchorMax.Length >= 2)
                rt.anchorMax = new Vector2(data.anchorMax[0], data.anchorMax[1]);
            if (data.offsetMin != null && data.offsetMin.Length >= 2)
                rt.offsetMin = new Vector2(data.offsetMin[0], data.offsetMin[1]);
            if (data.offsetMax != null && data.offsetMax.Length >= 2)
                rt.offsetMax = new Vector2(data.offsetMax[0], data.offsetMax[1]);
        }
    }
}
