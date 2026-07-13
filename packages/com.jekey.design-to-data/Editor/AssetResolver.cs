using UnityEditor;
using UnityEngine;

namespace D2D.Editor
{
    public static class AssetResolver
    {
        private const string DefaultPrimitiveMeshName = "Cube";

        public static AudioClip ResolveAudio(string name)
        {
            string[] guids = AssetDatabase.FindAssets("t:AudioClip " + name);
            if (guids.Length == 0)
            {
                Debug.LogWarning("[D2D] 에셋 미발견: " + name);
                return null;
            }
            string path = AssetDatabase.GUIDToAssetPath(guids[0]);
            return AssetDatabase.LoadAssetAtPath<AudioClip>(path);
        }

        public static Sprite ResolveSprite(string name)
        {
            string[] guids = AssetDatabase.FindAssets("t:Sprite " + name);
            if (guids.Length == 0)
            {
                Debug.LogWarning("[D2D] 에셋 미발견: " + name);
                return null;
            }
            string path = AssetDatabase.GUIDToAssetPath(guids[0]);
            return AssetDatabase.LoadAssetAtPath<Sprite>(path);
        }

        public static Mesh ResolveMesh(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                Debug.LogWarning($"[D2D] Mesh 이름이 비어 있어 기본 primitive '{DefaultPrimitiveMeshName}'로 대체");
                return ResolvePrimitiveMesh(DefaultPrimitiveMeshName);
            }

            Mesh primitive = ResolvePrimitiveMesh(name);
            if (primitive != null)
                return primitive;

            string[] guids = AssetDatabase.FindAssets(name + " t:Mesh");
            if (guids.Length == 0)
            {
                Debug.LogWarning($"[D2D] Mesh 에셋 미발견: {name}");
                return null;
            }
            string path = AssetDatabase.GUIDToAssetPath(guids[0]);
            return AssetDatabase.LoadAssetAtPath<Mesh>(path);
        }

        private static Mesh ResolvePrimitiveMesh(string name)
        {
            if (!TryParsePrimitiveType(name, out PrimitiveType primitiveType))
                return null;

            GameObject temp = GameObject.CreatePrimitive(primitiveType);
            Mesh mesh = temp.GetComponent<MeshFilter>()?.sharedMesh;
            UnityEngine.Object.DestroyImmediate(temp);
            return mesh;
        }

        private static bool TryParsePrimitiveType(string name, out PrimitiveType primitiveType)
        {
            switch (name.Trim().ToLowerInvariant())
            {
                case "cube":
                    primitiveType = PrimitiveType.Cube;
                    return true;
                case "sphere":
                    primitiveType = PrimitiveType.Sphere;
                    return true;
                case "capsule":
                    primitiveType = PrimitiveType.Capsule;
                    return true;
                case "cylinder":
                    primitiveType = PrimitiveType.Cylinder;
                    return true;
                case "plane":
                    primitiveType = PrimitiveType.Plane;
                    return true;
                case "quad":
                    primitiveType = PrimitiveType.Quad;
                    return true;
                default:
                    primitiveType = PrimitiveType.Cube;
                    return false;
            }
        }

        public static GameObject ResolvePrefab(string name)
        {
            string[] guids = AssetDatabase.FindAssets(name + " t:Prefab");
            if (guids.Length == 0)
            {
                Debug.LogWarning($"[D2D] Prefab 에셋 미발견: {name}");
                return null;
            }
            string path = AssetDatabase.GUIDToAssetPath(guids[0]);
            return AssetDatabase.LoadAssetAtPath<GameObject>(path);
        }
    }
}
