using UnityEngine;

namespace D2D.Editor
{
    public static class TransformReader
    {
        public static GdfTransform Read(Transform t)
        {
            return new GdfTransform
            {
                position = new float[] { t.localPosition.x, t.localPosition.y, t.localPosition.z },
                rotation = new float[] { t.localEulerAngles.x, t.localEulerAngles.y, t.localEulerAngles.z },
                scale    = new float[] { t.localScale.x, t.localScale.y, t.localScale.z }
            };
        }
    }
}
