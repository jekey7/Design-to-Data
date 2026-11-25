using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;
using UnityEngine;

namespace D2D.Editor
{
    public static class UidNormalizer
    {
        // 편입 모드 전용: go.name → GDS uid 패턴 (^[a-z0-9_]+$) 변환
        // [C4 V1] GameObject 기준으로 대응표를 만든다. 이전에는 go.name을 키로 써서
        // 이름이 같은 오브젝트가 모두 마지막 uid 하나를 받았다.
        public static Dictionary<GameObject, string> BuildUidMap(List<GameObject> allGOs)
        {
            var result   = new Dictionary<GameObject, string>();
            var usedUids = new HashSet<string>();

            foreach (var go in allGOs)
            {
                var uid = Normalize(go.name, usedUids);
                usedUids.Add(uid);
                result[go] = uid;
            }

            return result;
        }

        // [C4 V1] 편입 모드 전용: scene.name → GDS scene_name 패턴 (^[A-Za-z0-9_]+$) 변환
        public static string NormalizeSceneName(string sceneName)
        {
            var s = RemoveNonAscii((sceneName ?? "").Trim());
            s = Regex.Replace(s, @"[^A-Za-z0-9_]+", "_");
            s = Regex.Replace(s, @"_+", "_").Trim('_');
            return string.IsNullOrEmpty(s) ? "scene" : s;
        }

        // 단일 name → uid 변환 (외부 테스트용)
        public static string Normalize(string goName, HashSet<string> usedUids = null)
        {
            // 1. Trim
            var s = goName.Trim();

            // 2. "(Clone)" suffix 제거
            s = Regex.Replace(s, @"\(Clone\)", "", RegexOptions.IgnoreCase).Trim();

            // 3. 소문자화
            s = s.ToLowerInvariant();

            // 4. 공백·하이픈 → 언더스코어
            s = Regex.Replace(s, @"[\s\-]+", "_");

            // 5. 비ASCII 문자 제거
            s = RemoveNonAscii(s);

            // 5-1. [C4 V1] uid 패턴에서 허용하지 않는 나머지 문자(괄호, 점, & 등) → 언더스코어
            s = Regex.Replace(s, @"[^a-z0-9_]", "_");

            // 6. 연속 언더스코어 정리 + 앞뒤 언더스코어 제거
            s = Regex.Replace(s, @"_+", "_").Trim('_');

            // 비ASCII 제거 후 빈 문자열이면 "obj_unknown"으로 대체
            if (string.IsNullOrEmpty(s))
                s = "obj_unknown";

            // 7. 첫 문자가 숫자이면 "obj_" prefix 추가
            if (s.Length > 0 && char.IsDigit(s[0]))
                s = "obj_" + s;

            // 8. 중복 처리
            if (usedUids != null && usedUids.Contains(s))
            {
                var baseUid = s;
                int index = 1;
                string candidate;
                do
                {
                    candidate = $"{baseUid}_{index:D3}";
                    index++;
                } while (usedUids.Contains(candidate));
                s = candidate;
            }

            return s;
        }

        private static string RemoveNonAscii(string input)
        {
            var sb = new StringBuilder(input.Length);
            foreach (var c in input)
            {
                if (c <= 127)
                    sb.Append(c);
            }
            return sb.ToString();
        }
    }
}
