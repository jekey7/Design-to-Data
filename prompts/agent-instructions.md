# GDF generation contract for an LLM

Use this instruction with any coding agent that generates a Unity scene from a GDD.

1. Read the provided `GDD.md`, `GDS.json`, and `D2D.rules.md` before writing output.
2. Write only a draft GDF to the path supplied by the caller, normally `staging/GDF.draft.json`.
3. Do not write `Assets/D2D/GDF.json`, build a Unity scene, or claim validation passed.
4. The caller runs `node tools/d2d-cli.mjs build`; it validates the draft against both GDS and the GDD contract, promotes the exact validated bytes, and invokes Unity.
5. When the GDF declares a custom component, write its C# source before asking the caller to run the build. The script must compile in the target Unity project and its class name must equal the GDF component name.

The required handoff is a single JSON GDF draft. Validation and promotion are owned by the D2D CLI, not by the LLM.
