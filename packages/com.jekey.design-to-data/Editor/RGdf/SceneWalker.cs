using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace D2D.Editor
{
    public static class SceneWalker
    {
        // 씬의 모든 GO를 BFS 순서로 반환 (비활성 포함, D-1)
        // 부모가 자식보다 반드시 먼저 오는 순서 보장
        public static List<GameObject> GetAllGameObjects(Scene scene)
        {
            var result = new List<GameObject>();
            var roots = scene.GetRootGameObjects();

            foreach (var root in roots)
                CollectBFS(root, result);

            return result;
        }

        private static void CollectBFS(GameObject root, List<GameObject> result)
        {
            var queue = new Queue<GameObject>();
            queue.Enqueue(root);

            while (queue.Count > 0)
            {
                var go = queue.Dequeue();
                result.Add(go);

                var t = go.transform;
                for (int i = 0; i < t.childCount; i++)
                    queue.Enqueue(t.GetChild(i).gameObject);
            }
        }
    }
}
