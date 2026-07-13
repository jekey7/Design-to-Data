using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace D2D.Editor
{
    public static class RGdfModelMapper
    {
        public static GdfScene MapScene(Scene scene, List<GameObject> allGOs, ExtractMode mode)
        {
            // uid 빠른 조회를 위해 GO → uid 역매핑 먼저 구성
            var uidMap = BuildUidMap(allGOs, mode);

            var gdfObjects = new List<GdfGameObject>();
            foreach (var go in allGOs)
                gdfObjects.Add(MapGameObject(go, uidMap, mode));

            return new GdfScene
            {
                scene_name  = scene.name,
                gameObjects = gdfObjects
            };
        }

        // GO → uid 역매핑 딕셔너리
        // 검증 모드: uid = go.name (D-2)
        // 편입 모드: uid = UidNormalizer 경유 (D-2) — 6단계에서 구현, 지금은 검증 모드와 동일 처리
        private static Dictionary<GameObject, string> BuildUidMap(List<GameObject> allGOs, ExtractMode mode)
        {
            var map = new Dictionary<GameObject, string>();

            if (mode == ExtractMode.Validation)
            {
                foreach (var go in allGOs)
                    map[go] = go.name;
            }
            else
            {
                var nameToUid = UidNormalizer.BuildUidMap(allGOs);
                foreach (var go in allGOs)
                    map[go] = nameToUid[go.name];
            }

            return map;
        }

        private static GdfGameObject MapGameObject(GameObject go, Dictionary<GameObject, string> uidMap, ExtractMode mode)
        {
            var uid       = uidMap[go];
            var parentUid = go.transform.parent != null && uidMap.TryGetValue(go.transform.parent.gameObject, out var pUid)
                            ? pUid
                            : null;

            var layerName = LayerMask.LayerToName(go.layer);
            var isUI      = go.GetComponent<RectTransform>() != null && layerName == "UI";

            var gdfObj = new GdfGameObject
            {
                uid        = uid,
                name       = go.name,
                tag        = go.tag,
                layer      = layerName,
                parent_uid = parentUid,
                active     = go.activeSelf,
                components = ComponentExtractor.Extract(go, uidMap)
            };

            if (isUI)
                gdfObj.rectTransform = RectTransformReader.Read(go.GetComponent<RectTransform>());
            else
                gdfObj.gdfTransform = TransformReader.Read(go.transform);

            return gdfObj;
        }
    }
}
