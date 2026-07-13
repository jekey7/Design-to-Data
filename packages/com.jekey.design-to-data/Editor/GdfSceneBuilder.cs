using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace D2D.Editor
{
    public static class GdfSceneBuilder
    {
        public static bool _isBuilding;

        public static void Build(GdfRoot gdf)
        {
            if (_isBuilding) return;
            _isBuilding = true;

            try
            {
                PrefabBuilder.BuildAll(gdf.scenes);
                AssetDatabase.Refresh();

                foreach (var sceneData in gdf.scenes)
                    BuildScene(sceneData);

                AssetDatabase.Refresh();
            }
            finally
            {
                _isBuilding = false;
            }
        }

        private static void BuildScene(GdfScene sceneData)
        {
            Debug.Log($"[D2D] 씬 빌드 시작: {sceneData.scene_name}");

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            // NewScene 후 명시적으로 활성 씬 설정 — 없으면 new GameObject()가 씬 없는 상태로 생성됨
            UnityEngine.SceneManagement.SceneManager.SetActiveScene(scene);

            var sorted = TopologicalSort(sceneData.gameObjects);
            var goMap = GameObjectFactory.CreateAll(sorted, scene);

            ComponentBinder.BindAll(sorted, goMap);

            // Canvas 부착 후 RectTransform 적용 (Canvas 없으면 RT 설정 불가)
            GameObjectFactory.ApplyRectTransforms(sorted, goMap);

            EventLinker.LinkAll(sceneData.gameObjects, goMap);

            string scenesDir = Path.Combine(Application.dataPath, "D2D", "Scenes");
            Directory.CreateDirectory(scenesDir);

            string scenePath = $"Assets/D2D/Scenes/{sceneData.scene_name}.unity";
            bool saved = EditorSceneManager.SaveScene(scene, scenePath);

            if (saved)
                Debug.Log($"[D2D] 씬 저장 완료: {scenePath}");
            else
                Debug.LogError($"[D2D] 씬 저장 실패: {scenePath}");
        }

        private static List<GdfGameObject> TopologicalSort(List<GdfGameObject> gameObjects)
        {
            var uidMap = new Dictionary<string, GdfGameObject>();
            foreach (var go in gameObjects)
                uidMap[go.uid] = go;

            var result = new List<GdfGameObject>();
            var visited = new HashSet<string>();  // black
            var inStack = new HashSet<string>();  // grey

            void Visit(GdfGameObject node)
            {
                if (inStack.Contains(node.uid))
                {
                    Debug.LogWarning($"[D2D] 순환 참조 감지, 스킵: {node.uid}");
                    return;
                }
                if (visited.Contains(node.uid)) return;

                inStack.Add(node.uid);

                if (!string.IsNullOrEmpty(node.parent_uid) && uidMap.TryGetValue(node.parent_uid, out GdfGameObject parent))
                    Visit(parent);

                inStack.Remove(node.uid);
                visited.Add(node.uid);
                result.Add(node);
            }

            foreach (var go in gameObjects)
                Visit(go);

            return result;
        }
    }
}
