using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace D2D.Editor
{
    public static class AssetManifestBuilder
    {
        // 씬 전체 GO에서 실제 참조 중인 audio / ui_sprites 이름을 수집
        public static AssetManifest Build(List<GameObject> allGOs)
        {
            var audio     = new HashSet<string>();
            var uiSprites = new HashSet<string>();

            foreach (var go in allGOs)
            {
                foreach (var src in go.GetComponents<AudioSource>())
                {
                    if (src.clip != null)
                        audio.Add(src.clip.name);
                }

                foreach (var img in go.GetComponents<Image>())
                {
                    if (img.sprite != null)
                        uiSprites.Add(img.sprite.name);
                }
            }

            return new AssetManifest
            {
                audio      = new List<string>(audio),
                ui_sprites = new List<string>(uiSprites)
            };
        }
    }
}
