using UnityEngine;

namespace D2D.Editor
{
    public static class RectTransformReader
    {
        public static GdfRectTransform Read(RectTransform rt)
        {
            return new GdfRectTransform
            {
                anchoredPosition = new float[] { rt.anchoredPosition.x, rt.anchoredPosition.y, 0f },
                sizeDelta        = new float[] { rt.sizeDelta.x, rt.sizeDelta.y },
                pivot            = new float[] { rt.pivot.x, rt.pivot.y },
                anchorMin        = new float[] { rt.anchorMin.x, rt.anchorMin.y },
                anchorMax        = new float[] { rt.anchorMax.x, rt.anchorMax.y },
                offsetMin        = new float[] { rt.offsetMin.x, rt.offsetMin.y },
                offsetMax        = new float[] { rt.offsetMax.x, rt.offsetMax.y }
            };
        }
    }
}
