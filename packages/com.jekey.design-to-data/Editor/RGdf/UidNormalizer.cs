using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;
using UnityEngine;

namespace D2D.Editor
{
    public static class UidNormalizer
    {
        // 편입 모드 전용: go.name → GDS uid 패턴 (^[a-z0-9_]+$) 변환
        public static Dictionary<string, string> BuildUidMap(List<GameObject> allGOs)
        {
            var result   = new Dictionary<string, string>();
            var usedUids = new HashSet<string>();

            foreach (var go in allGOs)
            {
                var uid = Normalize(go.name, usedUids);
                usedUids.Add(uid);
                result[go.name] = uid;
            }

            return result;
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
