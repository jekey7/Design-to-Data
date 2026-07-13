using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace D2D.Editor
{
    public enum ExtractMode { Validation, Import }

    public static class RGdfExtractor
    {
        [MenuItem("D2D/Extract R-GDF/Validation Mode")]
        public static void ExtractValidation()
        {
            Extract(ExtractMode.Validation);
        }

        [MenuItem("D2D/Extract R-GDF/Import Mode")]
        public static void ExtractImport()
        {
            Extract(ExtractMode.Import);
        }

        public static void ExtractFromCLI()
        {
            var sceneGuids = AssetDatabase.FindAssets("t:Scene", new[] { "Assets" });
            if (sceneGuids.Length == 0)
            {
                Debug.LogError("[D2D] 추출 가능한 씬 없음");
                EditorApplication.Exit(1);
                return;
            }

            var scenes = new List<GdfScene>();
            var audio = new HashSet<string>();
            var uiSprites = new HashSet<string>();

            foreach (var guid in sceneGuids)
            {
                var scenePath = AssetDatabase.GUIDToAssetPath(guid);

                for (var i = SceneManager.sceneCount - 1; i > 0; i--)
                    EditorSceneManager.CloseScene(SceneManager.GetSceneAt(i), true);

                EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                EditorSceneManager.OpenScene(scenePath, OpenSceneMode.Single);

                var scene = SceneManager.GetActiveScene();
                var allGOs = SceneWalker.GetAllGameObjects(scene);
                scenes.Add(RGdfModelMapper.MapScene(scene, allGOs, ExtractMode.Import));

                var manifest = AssetManifestBuilder.Build(allGOs);
                foreach (var item in manifest.audio)
                    audio.Add(item);
                foreach (var item in manifest.ui_sprites)
                    uiSprites.Add(item);
            }

            var root = new GdfRoot
            {
                asset_manifest = new AssetManifest
                {
                    audio = new List<string>(audio),
                    ui_sprites = new List<string>(uiSprites)
                },
                scenes = scenes
            };

            var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
            RGdfSerializer.Write(root, $"Assets/D2D/RGdf/R-GDF_{timestamp}.json");
            AssetDatabase.Refresh();
            EditorApplication.Exit(0);
        }

        private static void Extract(ExtractMode mode)
        {
            var scene = SceneManager.GetActiveScene();
            if (!scene.IsValid())
            {
                Debug.LogError("[D2D] R-GDF 추출 실패: 활성 씬이 없습니다.");
                return;
            }

            Debug.Log($"[D2D] R-GDF 추출 시작 — 씬: {scene.name}, 모드: {mode}");

            var allGOs = SceneWalker.GetAllGameObjects(scene);
            Debug.Log($"[D2D] 순회된 GameObject 수: {allGOs.Count} (비활성 포함)");

            var gdfScene   = RGdfModelMapper.MapScene(scene, allGOs, mode);
            var manifest   = AssetManifestBuilder.Build(allGOs);

            var root = new GdfRoot
            {
                asset_manifest = manifest,
                scenes         = new List<GdfScene> { gdfScene }
            };

            var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
            string outputPath;

            if (mode == ExtractMode.Validation)
                outputPath = $"Assets/D2D/RGdf/R-GDF_{scene.name}_{timestamp}.json";
            else
                outputPath = $"Assets/D2D/RGdf/Draft/R-GDF_Draft_{scene.name}_{timestamp}.json";

            RGdfSerializer.Write(root, outputPath);
            AssetDatabase.Refresh();

            if (mode == ExtractMode.Import)
                Debug.Log("[D2D] Validate the exported R-GDF with the D2D CLI before importing it elsewhere.");
        }
    }
}




