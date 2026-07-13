using System;
using System.IO;
using Newtonsoft.Json;
using UnityEditor;
using UnityEngine;

namespace D2D.Editor
{
    /// <summary>
    /// Explicit entry point for a GDF that has already been validated by the D2D CLI.
    /// This class deliberately does not watch imported JSON files: scene changes occur
    /// only through the menu item or the CLI entry point.
    /// </summary>
    public static class GdfBuilder
    {
        [MenuItem("D2D/Build GDF", false, 10)]
        private static void BuildFromMenu()
        {
            var path = EditorUtility.OpenFilePanel("Select validated GDF", Application.dataPath, "json");
            if (string.IsNullOrEmpty(path)) return;

            if (!path.StartsWith(Application.dataPath, StringComparison.OrdinalIgnoreCase))
            {
                Debug.LogError("[D2D] Select a GDF located under this Unity project's Assets folder.");
                return;
            }

            var assetPath = "Assets" + path.Substring(Application.dataPath.Length).Replace('\\', '/');
            Build(assetPath);
        }

        public static void BuildFromCLI()
        {
            var gdfPath = ReadArgument("-gdfPath");
            var succeeded = !string.IsNullOrEmpty(gdfPath) && Build(gdfPath);

            if (string.IsNullOrEmpty(gdfPath))
                Debug.LogError("[D2D] BuildFromCLI requires -gdfPath Assets/<path>.json.");

            EditorApplication.Exit(succeeded ? 0 : 1);
        }

        public static bool Build(string gdfAssetPath)
        {
            if (string.IsNullOrWhiteSpace(gdfAssetPath) || !gdfAssetPath.StartsWith("Assets/", StringComparison.Ordinal))
            {
                Debug.LogError("[D2D] GDF path must be an Assets-relative path.");
                return false;
            }

            var projectRoot = Path.GetFullPath(Path.Combine(Application.dataPath, ".."));
            var gdfFullPath = Path.GetFullPath(Path.Combine(projectRoot, gdfAssetPath));
            if (!gdfFullPath.StartsWith(projectRoot, StringComparison.OrdinalIgnoreCase) || !File.Exists(gdfFullPath))
            {
                Debug.LogError($"[D2D] GDF file not found: {gdfAssetPath}");
                return false;
            }

            try
            {
                var json = File.ReadAllText(gdfFullPath);
                var root = JsonConvert.DeserializeObject<GdfRoot>(json,
                    new JsonSerializerSettings { MissingMemberHandling = MissingMemberHandling.Ignore });

                if (root?.scenes == null || root.scenes.Count == 0)
                {
                    Debug.LogError("[D2D] GDF contains no scenes.");
                    return false;
                }

                GdfSceneBuilder.Build(root);

                foreach (var scene in root.scenes)
                {
                    var scenePath = Path.Combine(Application.dataPath, "D2D", "Scenes", $"{scene.scene_name}.unity");
                    if (!File.Exists(scenePath))
                    {
                        Debug.LogError($"[D2D] Scene was not created: {scenePath}");
                        return false;
                    }
                }

                Debug.Log($"[D2D] Built {root.scenes.Count} scene(s) from {gdfAssetPath}.");
                return true;
            }
            catch (Exception exception)
            {
                Debug.LogError($"[D2D] GDF build failed: {exception}");
                return false;
            }
        }

        private static string ReadArgument(string name)
        {
            var args = Environment.GetCommandLineArgs();
            for (var i = 0; i < args.Length - 1; i++)
            {
                if (args[i] == name) return args[i + 1];
            }
            return null;
        }
    }
}
