# GDS.rules.md — LLM GDF 생성 지침 v2.1

> 이 문서는 **LLM 플래너 전용** 생성 지침이다.
> GDD를 GDF로 변환하고 게임을 완성하기까지 LLM이 반드시 준수해야 할 규칙만 포함한다.

---

## 섹션 0. 파이프라인 — 반드시 끝까지 완료할 것

GDD를 받으면 아래 순서를 **모두 완료**해야 한다. 중간에 멈추지 말 것.

1. GDD 전체를 분석하여 필요한 오디오 에셋·UI 스프라이트·프리팹 이름을 확정하고 `asset_manifest`에 선언한다. 프리팹이 사용되는 경우 `asset_manifest.prefabs` 배열에 이름을 선언한다. 커스텀 스크립트 목록도 이 단계에서 확정한다.
2. GDF 내용을 작성한다 (아직 파일로 저장하지 않는다).
3. GDF의 모든 `isCustomScript: true` 컴포넌트에 대응하는 C# 스크립트를 `Assets/D2D/Scripts/`에 작성한다.
4. GDF를 `Assets/D2D/GDF.json`으로 저장한다 (Unity Editor가 감지하여 씬을 자동 빌드).

> **이유:** Unity Editor는 GDF.json 저장을 감지하는 순간 씬 빌드를 시작한다. 커스텀 스크립트가 GDF.json보다 먼저 저장되어야 컴파일이 완료된 상태로 빌드가 진행된다.

---

## 섹션 1. 참조 무결성

### RULE-R01 — parent_uid 참조 무결성

`parent_uid`가 `null`이 아닌 경우, 해당 값은 반드시 **동일 씬** `gameObjects` 내에 존재하는 `uid`여야 한다.

**위반 예시**
```json
{ "uid": "obj_child", "parent_uid": "obj_nonexistent" }
```

---

### RULE-R02 — UI 오브젝트는 반드시 Canvas 계층 하위에 배치

`layer: "UI"`인 오브젝트 중 `Canvas` 컴포넌트를 직접 보유하지 않는 오브젝트는, 상위 체인을 따라 올라갔을 때 반드시 `Canvas` 컴포넌트를 보유한 조상이 존재해야 한다.

---

### RULE-R03 — AudioSource.clip은 asset_manifest.audio에 선언된 이름이어야 한다

`AudioSource` 컴포넌트의 `properties.clip` 값은 반드시 `asset_manifest.audio` 배열에 미리 선언된 이름이어야 한다.

---

### RULE-R04 — Image.sprite는 asset_manifest.ui_sprites에 선언된 이름이어야 한다

`Image` 컴포넌트의 `properties.sprite` 값은 반드시 `asset_manifest.ui_sprites` 배열에 미리 선언된 이름이어야 한다.

---

### RULE-R05 — prefab 참조는 asset_manifest.prefabs에 선언된 이름이어야 한다

컴포넌트 `properties` 내 `"prefab:"` prefix를 가진 값은 반드시 `asset_manifest.prefabs` 배열에 미리 선언된 이름이어야 한다.

**올바른 예시**
```json
{
  "asset_manifest": {
    "audio": [],
    "ui_sprites": [],
    "prefabs": ["EnemyPrefab", "BulletPrefab"]
  }
}
```
컴포넌트 properties에서 참조:
```json
{ "enemyTemplate": "prefab:EnemyPrefab" }
```

**위반 예시**
```json
{ "enemyTemplate": "prefab:UndeclaredPrefab" }
```
`UndeclaredPrefab`이 `asset_manifest.prefabs`에 없으면 위반.

---

## 섹션 2. GDF 생성 규칙

### RULE-G01 — GDF 생성 기본 원칙

- GDD에 명시되지 않은 항목은 포함하지 않는다. Unity 엔진의 기술적 종속성에 의해 요구되는 컴포넌트는 예외로 한다.
- GDF는 `Assets/D2D/GDF.json`으로 저장한다.
- 모든 `uid`는 씬 내에서 고유해야 하며 `snake_case` 소문자로 작성한다.
- `GDS.json`(JSON Schema) 구조를 최우선으로 준수한다.

---

### RULE-G02 — UI 오브젝트 배치 원칙

- `layer: "UI"`인 모든 오브젝트는 `transform` 대신 `rectTransform`을 사용한다.
- UI 오브젝트는 반드시 `Canvas` 컴포넌트를 보유한 오브젝트의 자식(직접 또는 간접)이어야 한다.
- Canvas 루트 오브젝트(`Canvas` 컴포넌트 보유)의 `parent_uid`는 `null`로 설정한다.

---

### RULE-G03 — Canvas 해상도 기본값

`Canvas` 컴포넌트를 보유한 오브젝트는 반드시 `CanvasScaler` 컴포넌트를 함께 포함해야 한다 (페어링 규칙은 RULE-G06 참조). 해상도 기본값은 아래 표를 따른다.

| 플랫폼 | referenceResolution |
|--------|---------------------|
| PC / 콘솔 | `[1920, 1080]` |
| 모바일 | `[1080, 1920]` |

GDD에 플랫폼 명시가 없으면 PC/콘솔 기준을 기본값으로 사용한다.

**올바른 예시**
```json
{
  "name": "Canvas",
  "isCustomScript": false,
  "properties": { "renderMode": "ScreenSpaceOverlay", "sortingOrder": 0 }
},
{
  "name": "CanvasScaler",
  "isCustomScript": false,
  "properties": {
    "uiScaleMode": "ScaleWithScreenSize",
    "referenceResolution": [1920, 1080],
    "screenMatchMode": "MatchWidthOrHeight",
    "matchWidthOrHeight": 0.5
  }
}
```

---

### RULE-G04 — 사운드 루프 기본값

`AudioSource` 컴포넌트의 `loop` 값은 GDD 맥락에서 오디오 역할을 판단하여 설정한다.

| 역할 | loop 값 | 판단 기준 |
|------|---------|----------|
| BGM (배경음악) | `true` | "배경음악", "BGM", "ambient", 씬 전반에 걸쳐 반복 재생 |
| SFX (효과음) | `false` | "효과음", "SFX", 특정 이벤트에 반응하는 1회성 사운드 |

GDD에 역할 구분이 명시되지 않은 경우 `loop: false`를 기본값으로 사용한다.

---

### RULE-G05 — Camera 오브젝트 생성 원칙

Camera 오브젝트는 `type: "Camera"` 필드를 사용하지 않는다(deprecated). 대신 `components` 배열에 `name: "Camera"`인 컴포넌트를 포함하는 방식으로 Camera임을 표현한다.

**올바른 예시**
```json
{
  "uid": "obj_camera_main",
  "name": "MainCamera",
  "tag": "MainCamera",
  "layer": "Default",
  "parent_uid": null,
  "transform": { "position": [0, 1, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1] },
  "components": [
    {
      "name": "Camera",
      "isCustomScript": false,
      "properties": { "fieldOfView": 60 }
    },
    {
      "name": "AudioListener",
      "isCustomScript": false,
      "properties": {}
    }
  ]
}
```

---

### RULE-G06 — Unity 컴포넌트 종속성 페어링 원칙

Unity에서 특정 컴포넌트는 없으면 에러가 발생하는 하드 종속성을 가진다. 아래 표의 컴포넌트를 선언할 때는 종속 컴포넌트를 반드시 함께 포함해야 한다.

| 컴포넌트 | 반드시 함께 필요한 컴포넌트 |
|---------|--------------------------|
| `MeshRenderer` | `MeshFilter` |
| `GraphicRaycaster` | `Canvas` |
| `Canvas` | `CanvasScaler` |
| `Camera` | `AudioListener` (같은 오브젝트에 배치, 씬 내 반드시 하나 존재해야 함) |

이 표는 Unity가 에러를 발생시키는 하드 종속성만 포함한다. 그 외 컴포넌트 조합(예: Rigidbody + Collider)은 GDD 맥락에 따라 LLM이 판단한다.

`MeshFilter.properties.mesh`는 절대 빈 문자열로 작성하지 않는다. GDD에 구체적인 메시 에셋명이 없으면 오브젝트의 역할에 맞는 Unity primitive 메시명(`Cube`, `Sphere`, `Capsule`, `Cylinder`, `Plane`, `Quad`)을 작성하며, 판단할 단서가 없으면 `Cube`를 기본값으로 사용한다.

**올바른 예시 (MeshRenderer + MeshFilter)**
```json
{
  "components": [
    {
      "name": "MeshFilter",
      "isCustomScript": false,
      "properties": { "mesh": "Cube" }
    },
    {
      "name": "MeshRenderer",
      "isCustomScript": false,
      "properties": {}
    }
  ]
}
```

---

### RULE-G08 — 오브젝트 구성 페어링 원칙

특정 컴포넌트가 존재할 때 씬 또는 계층 구조 내에 반드시 함께 존재해야 하는 오브젝트·자식 구조를 정의한다. RULE-G06의 컴포넌트 간 하드 종속성과 달리, 이 규칙은 **씬 스코프** 또는 **부모-자식 계층** 단위의 구성 패턴을 다룬다.

#### 씬 스코프 페어링

| 조건 | 반드시 필요한 것 | 없으면 발생하는 문제 |
|------|----------------|-------------------|
| 씬에 `Canvas` 컴포넌트를 보유한 오브젝트가 존재 | `EventSystem` 컴포넌트를 보유한 오브젝트가 씬에 정확히 1개 존재 | 모든 UI 포인터 입력(클릭, 드래그 등) 불능 |

#### 부모-자식 페어링

| 조건 | 반드시 필요한 자식 구조 | 없으면 발생하는 문제 |
|------|----------------------|-------------------|
| `Button` 컴포넌트 보유 오브젝트 | `Text` 또는 `TextMeshProUGUI` 컴포넌트를 보유한 직계 자식 오브젝트 1개 이상 | 버튼 레이블 표시 불가 |
| `ScrollRect` 컴포넌트 보유 오브젝트 | `Mask` 컴포넌트를 보유한 `Viewport` 자식, 그 자식으로 `Content` 오브젝트 | 스크롤 영역 렌더링 및 클리핑 불가 |
| `InputField` 컴포넌트 보유 오브젝트 | `Text` 또는 `TextMeshProUGUI` 자식(입력값 표시용), `Text` 또는 `TextMeshProUGUI` 자식(Placeholder용) | 입력 텍스트 및 힌트 표시 불가 |

> **주의:** `EventSystem` 오브젝트는 UI 입력 처리 역할을 하지만 Canvas 계층에 속하지 않는다. 반드시 `layer: "Default"` + `transform`을 사용해야 한다. `layer: "UI"` 또는 `rectTransform` 사용 금지.

**올바른 예시 (Canvas + EventSystem)**
```json
[
  {
    "uid": "obj_canvas",
    "name": "Canvas",
    "components": [
      { "name": "Canvas", "isCustomScript": false, "properties": { "renderMode": "ScreenSpaceOverlay" } },
      { "name": "CanvasScaler", "isCustomScript": false, "properties": { "uiScaleMode": "ScaleWithScreenSize", "referenceResolution": [1920, 1080], "screenMatchMode": "MatchWidthOrHeight", "matchWidthOrHeight": 0.5 } },
      { "name": "GraphicRaycaster", "isCustomScript": false, "properties": {} }
    ]
  },
  {
    "uid": "obj_event_system",
    "name": "EventSystem",
    "components": [
      { "name": "EventSystem", "isCustomScript": false, "properties": {} },
      { "name": "StandaloneInputModule", "isCustomScript": false, "properties": {} }
    ]
  }
]
```

**올바른 예시 (Button + Text 자식)**
```json
{
  "uid": "obj_btn_start",
  "name": "StartButton",
  "components": [
    { "name": "Image", "isCustomScript": false, "properties": {} },
    { "name": "Button", "isCustomScript": false, "properties": {} }
  ]
},
{
  "uid": "obj_btn_start_label",
  "name": "Text",
  "parent_uid": "obj_btn_start",
  "components": [
    { "name": "Text", "isCustomScript": false, "properties": { "text": "Start" } }
  ]
}
```

---

### RULE-G09 — 복합 UI 컴포넌트 표준 자식 구조

아래 컴포넌트들은 자식 계층 구조가 Unity 표준으로 정형화되어 있다. 해당 컴포넌트를 GDF에 포함할 때는 아래 표의 자식 계층을 그대로 구성해야 한다.

#### Slider

```
<Slider 오브젝트> [Slider]
├── Background          [Image]
├── Fill Area           
│   └── Fill            [Image]
└── Handle Slide Area   
    └── Handle          [Image]
```

#### Toggle

```
<Toggle 오브젝트> [Toggle]
├── Background          [Image]
│   └── Checkmark       [Image]
└── Label               [Text 또는 TextMeshProUGUI]
```

#### Dropdown

```
<Dropdown 오브젝트> [Dropdown 또는 TMP_Dropdown]
├── Label               [Text 또는 TextMeshProUGUI]
├── Arrow               [Image]
└── Template (비활성)   [ScrollRect, CanvasGroup]
    └── Viewport        [Mask, Image]
        └── Content     
            └── Item    [Toggle]
                ├── Item Background  [Image]
                ├── Item Checkmark   [Image]
                └── Item Label       [Text 또는 TextMeshProUGUI]
```

#### Scrollbar

```
<Scrollbar 오브젝트> [Scrollbar]
└── Sliding Area        
    └── Handle          [Image]
```

> **생성 원칙:** LLM은 위 컴포넌트 중 하나를 GDF에 포함할 때 표준 자식 구조 전체를 함께 생성해야 한다. 자식 오브젝트를 일부만 생성하거나 생략하면 안 된다.

---

### RULE-G07 — 커스텀 스크립트 작성 원칙

`isCustomScript: true`인 컴포넌트는 GDF 저장 **전에** 반드시 C# 스크립트를 작성해야 한다.

- 저장 경로: `Assets/D2D/Scripts/<ComponentName>.cs`
- 네임스페이스: `D2D`
- `MonoBehaviour`를 상속해야 한다.
- GDF의 `properties`에 명시된 필드는 `public` 또는 `[SerializeField]`로 선언한다.

**올바른 예시**
```csharp
using UnityEngine;

namespace D2D
{
    public class GameManager : MonoBehaviour
    {
        public int score;
        public bool isGameOver;
    }
}
```

---

## 섹션 3. 규칙 색인

| 규칙 ID | 한 줄 요약 |
|---------|-----------|
| RULE-R01 | parent_uid는 같은 씬의 uid를 가리켜야 한다 |
| RULE-R02 | UI 오브젝트는 Canvas 계층 하위에 있어야 한다 |
| RULE-R03 | AudioSource.clip은 asset_manifest.audio에 선언된 이름이어야 한다 |
| RULE-R04 | Image.sprite는 asset_manifest.ui_sprites에 선언된 이름이어야 한다 |
| RULE-G01 | GDF 생성 기본 원칙 (경로: Assets/D2D/GDF.json) |
| RULE-G02 | UI 오브젝트는 rectTransform 사용, Canvas 하위 배치 |
| RULE-G03 | Canvas마다 CanvasScaler 포함, matchWidthOrHeight 필드명 사용 |
| RULE-G04 | BGM은 loop: true, SFX는 loop: false |
| RULE-G05 | Camera는 컴포넌트로 표현, type 필드 사용 금지 |
| RULE-G06 | Unity 하드 종속성 페어링 |
| RULE-G07 | isCustomScript: true 컴포넌트는 GDF 저장 전에 C# 스크립트 작성 |
| RULE-G08 | 씬/계층 스코프 오브젝트 구성 페어링 (Canvas↔EventSystem, Button↔Text 자식 등) |
| RULE-G09 | 복합 UI 컴포넌트(Slider, Toggle, Dropdown, Scrollbar) 표준 자식 구조 |
| RULE-R05 | prefab 참조 필드는 asset_manifest.prefabs에 선언된 이름이어야 한다 |
