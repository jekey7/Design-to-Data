# Pipeline contract

`d2d-cli build` is the supported automated path from a generated GDF to a Unity scene.

1. An LLM reads the GDD, `validator/GDS.json`, and `validator/D2D.rules.md` and writes a draft GDF outside the Unity project.
2. The CLI validates that draft with `validateWithGddContract`.
3. On failure, the CLI exits non-zero and does not create or replace `Assets/D2D/GDF.json`.
4. On success, the CLI copies the exact validated bytes to `Assets/D2D/GDF.json` and verifies its SHA-256 hash.
5. Unity runs `D2D.Editor.GdfBuilder.BuildFromCLI` for that exact Assets-relative path. Any parsing or scene-output failure exits Unity with status 1.

The Unity package has no JSON import watcher. Importing an arbitrary JSON asset therefore cannot silently modify a project.

R-GDF export is also explicit: `d2d-cli export` runs the extractor and validates its resulting R-GDF before reporting success.
