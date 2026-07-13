// rules/component-whitelist.js
// Deterministic component token allowlist for explicit GDD contract extraction.

export const BUILTIN_COMPONENTS = new Set([
  "Animator",
  "AudioListener",
  "AudioSource",
  "BoxCollider",
  "BoxCollider2D",
  "Button",
  "Camera",
  "Canvas",
  "CanvasGroup",
  "CanvasRenderer",
  "CanvasScaler",
  "CapsuleCollider",
  "CapsuleCollider2D",
  "CharacterController",
  "CircleCollider2D",
  "Collider",
  "Collider2D",
  "Dropdown",
  "EdgeCollider2D",
  "EventSystem",
  "GraphicRaycaster",
  "GridLayoutGroup",
  "HorizontalLayoutGroup",
  "Image",
  "InputField",
  "LayoutElement",
  "Light",
  "Mask",
  "MeshCollider",
  "MeshFilter",
  "MeshRenderer",
  "ParticleSystem",
  "ParticleSystemRenderer",
  "PolygonCollider2D",
  "RawImage",
  "RectMask2D",
  "Rigidbody",
  "Rigidbody2D",
  "ScrollRect",
  "Scrollbar",
  "SkinnedMeshRenderer",
  "SphereCollider",
  "StandaloneInputModule",
  "Text",
  "TextMeshProUGUI",
  "TMP_Dropdown",
  "Toggle",
  "Transform",
  "VerticalLayoutGroup"
]);

const CUSTOM_SCRIPT_SUFFIXES = [
  "Behaviour",
  "Behavior",
  "Controller",
  "Manager",
  "System",
  "View"
];

export function isBuiltinComponent(name) {
  return BUILTIN_COMPONENTS.has(name);
}

export function isCustomScriptCandidate(name, customScriptNames = new Set()) {
  if (customScriptNames.has(name)) return true;
  return /^[A-Z][A-Za-z0-9_]*$/.test(name)
    && CUSTOM_SCRIPT_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

export function isComponentToken(name, customScriptNames = new Set()) {
  return isBuiltinComponent(name) || isCustomScriptCandidate(name, customScriptNames);
}

export function componentNames() {
  return [...BUILTIN_COMPONENTS];
}
