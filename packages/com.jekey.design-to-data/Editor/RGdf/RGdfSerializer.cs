using System.IO;
using Newtonsoft.Json;
using UnityEngine;

namespace D2D.Editor
{
    public static class RGdfSerializer
    {
        public static void Write(GdfRoot root, string outputPath)
        {
            var dir = Path.GetDirectoryName(outputPath);
            if (!Directory.Exists(dir))
                Directory.CreateDirectory(dir);

            var json = JsonConvert.SerializeObject(root, Formatting.Indented,
                new JsonSerializerSettings { NullValueHandling = NullValueHandling.Ignore });

            File.WriteAllText(outputPath, json);
            Debug.Log($"[D2D] R-GDF 저장 완료: {outputPath}");
        }
    }
}
