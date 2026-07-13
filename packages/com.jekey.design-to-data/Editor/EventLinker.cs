using System;
using System.Collections.Generic;
using System.Reflection;
using UnityEditor.Events;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.UI;

namespace D2D.Editor
{
    public static class EventLinker
    {
        public static void LinkAll(List<GdfGameObject> goData, Dictionary<string, GameObject> goMap)
        {
            foreach (var data in goData)
            {
                if (!goMap.TryGetValue(data.uid, out GameObject sourceGo)) continue;
                if (data.components == null) continue;

                foreach (var comp in data.components)
                {
                    if (comp.events == null) continue;

                    foreach (var kvp in comp.events)
                    {
                        if (kvp.Key != "onClick")
                        {
                            Debug.LogWarning($"[D2D] 미지원 이벤트 타입 스킵: {kvp.Key}");
                            continue;
                        }

                        foreach (var binding in kvp.Value)
                            ProcessOnClick(sourceGo, binding, goMap);
                    }
                }
            }
        }

        private static void ProcessOnClick(GameObject sourceGo, GdfEventBinding binding, Dictionary<string, GameObject> goMap)
        {
            var button = sourceGo.GetComponent<Button>();
            if (button == null)
            {
                Debug.LogWarning($"[D2D] onClick 이벤트 대상에 Button 컴포넌트 없음: {sourceGo.name}");
                return;
            }

            string uid = binding.target_uid?.TrimStart('@');
            if (string.IsNullOrEmpty(uid) || !goMap.TryGetValue(uid, out GameObject targetGo))
            {
                Debug.LogWarning($"[D2D] onClick 이벤트 target_uid 미발견: {binding.target_uid}");
                return;
            }

            Type targetType = ResolveType(binding.component);
            if (targetType == null)
            {
                Debug.LogWarning($"[D2D] 이벤트 바인딩 컴포넌트 타입 미발견: {binding.component}");
                return;
            }

            Component targetComp = targetGo.GetComponent(targetType);
            if (targetComp == null)
            {
                Debug.LogWarning($"[D2D] 이벤트 바인딩 대상 컴포넌트 없음: {binding.component} on {targetGo.name}");
                return;
            }

            MethodInfo method = targetType.GetMethod(binding.method, BindingFlags.Public | BindingFlags.Instance);
            if (method == null)
            {
                Debug.LogWarning($"[D2D] 이벤트 바인딩 메서드 미발견: {binding.component}.{binding.method}");
                return;
            }

            try
            {
                if (binding.param == null)
                {
                    var action = (UnityAction)Delegate.CreateDelegate(typeof(UnityAction), targetComp, method);
                    UnityEventTools.AddPersistentListener(button.onClick, action);
                }
                else if (binding.param is string strParam)
                {
                    // Button.onClick은 파라미터 없는 UnityEvent이므로 람다로 래핑
                    var capturedParam = strParam;
                    var innerAction = (UnityAction<string>)Delegate.CreateDelegate(typeof(UnityAction<string>), targetComp, method);
                    UnityAction action = () => innerAction(capturedParam);
                    UnityEventTools.AddPersistentListener(button.onClick, action);
                }
                else
                {
                    ParameterInfo[] paramInfos = method.GetParameters();
                    if (paramInfos.Length > 0 && paramInfos[0].ParameterType == typeof(int))
                    {
                        int capturedParam = Convert.ToInt32(binding.param);
                        var innerAction = (UnityAction<int>)Delegate.CreateDelegate(typeof(UnityAction<int>), targetComp, method);
                        UnityAction action = () => innerAction(capturedParam);
                        UnityEventTools.AddPersistentListener(button.onClick, action);
                    }
                    else
                    {
                        float capturedParam = Convert.ToSingle(binding.param);
                        var innerAction = (UnityAction<float>)Delegate.CreateDelegate(typeof(UnityAction<float>), targetComp, method);
                        UnityAction action = () => innerAction(capturedParam);
                        UnityEventTools.AddPersistentListener(button.onClick, action);
                    }
                }
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[D2D] 이벤트 바인딩 실패 스킵: {binding.component}.{binding.method} — {e.Message}");
            }
        }

        private static Type ResolveType(string name)
        {
            if (string.IsNullOrEmpty(name)) return null;

            Type direct = Type.GetType(name);
            if (direct != null) return direct;

            foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
            {
                foreach (var t in assembly.GetTypes())
                {
                    if (t.Name == name) return t;
                }
            }

            return null;
        }
    }
}
