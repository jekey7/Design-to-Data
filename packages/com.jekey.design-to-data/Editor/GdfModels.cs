using System.Collections.Generic;
using Newtonsoft.Json;

namespace D2D.Editor
{
    public class GdfRoot
    {
        public AssetManifest asset_manifest;
        public List<GdfScene> scenes;
    }

    public class AssetManifest
    {
        public List<string> audio;
        public List<string> ui_sprites;
        public List<string> prefabs;
    }

    public class GdfScene
    {
        public string scene_name;
        public List<GdfGameObject> gameObjects;
        public List<GdfPrefab> prefabs;
    }

    public class GdfPrefab
    {
        public string uid;
        public string name;
        public string tag;
        public string layer;

        [JsonProperty("transform")]
        public GdfTransform gdfTransform;

        public GdfRectTransform rectTransform;
        public List<GdfComponent> components;
    }

    public class GdfGameObject
    {
        public string uid;
        public string name;
        public string tag;
        public string layer;
        [JsonProperty(NullValueHandling = NullValueHandling.Include)]
        public string parent_uid;
        public bool active = true;

        [JsonProperty("transform")]
        public GdfTransform gdfTransform;

        public GdfRectTransform rectTransform;
        public List<GdfComponent> components;
    }

    public class GdfTransform
    {
        public float[] position;
        public float[] rotation;
        public float[] scale;
    }

    public class GdfRectTransform
    {
        public float[] anchoredPosition;
        public float[] sizeDelta;
        public float[] pivot;
        public float[] anchorMin;
        public float[] anchorMax;
        public float[] offsetMin;
        public float[] offsetMax;
    }

    public class GdfComponent
    {
        public string name;
        public bool isCustomScript;
        public Dictionary<string, object> properties;
        public Dictionary<string, List<GdfEventBinding>> events;
    }

    public class GdfEventBinding
    {
        public string target_uid;
        public string component;
        public string method;
        [JsonProperty(NullValueHandling = NullValueHandling.Include)]
        public object param;
    }
}
