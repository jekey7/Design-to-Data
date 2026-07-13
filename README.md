# Design-to-Data

Design-to-Data (D2D) turns a Game Design Document (GDD) into a validated Game Design Format (GDF) document, then builds Unity scenes from the exact GDF that passed validation. It also exports Unity scenes as R-GDF.

The repository contains a Node.js validator and CLI plus a Unity Package Manager (UPM) package. It does not include an LLM provider: supply the agent of your choice with [the generation contract](prompts/agent-instructions.md).

## Guarantees

- A draft GDF is checked against `GDS.json` and, when supplied, the GDD contract before Unity is started.
- Invalid drafts are never promoted into a Unity project.
- The promoted file is SHA-256 checked against the validated draft.
- Unity scene-build failures return a non-zero process status.
- The Unity package does not watch every imported JSON file or change a project implicitly.

## Requirements

- Node.js 21 or later
- Unity 6000.3 or later
- Git

## Install

Clone this repository and install validator dependencies:

```bash
git clone https://github.com/jekey7/Design-to-Data.git
cd Design-to-Data/validator
npm ci
```

Install the Unity package in your project using Package Manager > **Add package from disk** and select:

```text
packages/com.jekey.design-to-data/package.json
```

For a Git URL installation, use a release tag rather than the default branch:

```text
https://github.com/jekey7/Design-to-Data.git?path=/packages/com.jekey.design-to-data#v0.1.0
```

## Build a scene from an LLM-generated GDF

Give the LLM the GDD, `validator/GDS.json`, `validator/D2D.rules.md`, and [the generation contract](prompts/agent-instructions.md). It must write a draft, for example `staging/GDF.draft.json`.

Then run:

```bash
node tools/d2d-cli.mjs build \
  --gdf staging/GDF.draft.json \
  --gdd examples/basic-gdd.md \
  --unity-project /path/to/UnityProject \
  --unity-exe /path/to/Unity
```

The default promoted file is `Assets/D2D/GDF.json`; generated scenes are under `Assets/D2D/Scenes`.

## Validate or export

```bash
node tools/d2d-cli.mjs validate --gdf staging/GDF.draft.json --gdd examples/basic-gdd.md

node tools/d2d-cli.mjs export \
  --unity-project /path/to/UnityProject \
  --unity-exe /path/to/Unity
```

`export` extracts every Unity scene under `Assets/` into one R-GDF file and validates it.

## Development

Run the validator tests:

```bash
cd validator
npm test -- --runInBand
```

See [the pipeline contract](docs/pipeline-contract.md) for the ownership and failure rules.

## License

[MIT](LICENSE)
