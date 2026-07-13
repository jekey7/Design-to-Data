// rules/gdd-contract-validator.js
// Validate that generated GDF preserves explicit object-component contracts from the GDD.

import { extractGddContracts } from "./gdd-contract-extractor.js";

export function validateGddContracts(gddText, gdf) {
  const extracted = extractGddContracts(gddText);

  if (!gdf || !Array.isArray(gdf.scenes)) {
    return {
      valid: false,
      errors: [{
        code: "GDD_CONTRACT_GDF_STRUCTURE",
        severity: "error",
        path: "(root)",
        message: "GDD contract check requires a GDF root with scenes[]."
      }],
      warnings: extracted.warnings,
      contracts: extracted.contracts
    };
  }

  const gdfObjects = flattenObjects(gdf);
  const errors = [];

  for (const contract of extracted.contracts) {
    const matches = findMatchingObjects(gdfObjects, contract.object);
    const components = contract.required_components ?? [];
    const source = contract.source ? ` at GDD line ${contract.source.line}` : "";

    if (matches.length === 0) {
      errors.push({
        code: "GDD_CONTRACT_MISSING_OBJECT",
        severity: "error",
        path: `GDD.contracts[${contract.object}]`,
        message: `GDD explicitly declares object "${contract.object}"${source}, but no matching GDF object was found.`
      });
      continue;
    }

    if (matches.length > 1) {
      errors.push({
        code: "GDD_CONTRACT_AMBIGUOUS_MATCH",
        severity: "error",
        path: `GDD.contracts[${contract.object}]`,
        message: `GDD explicit object "${contract.object}"${source} matches ${matches.length} GDF objects.`
      });
      continue;
    }

    const match = matches[0];
    const actual = componentNames(match.object);
    for (const component of components) {
      if (actual.includes(component)) continue;
      errors.push({
        code: "GDD_CONTRACT_MISSING_COMPONENT",
        severity: "error",
        path: `scenes[${match.scene_name}].gameObjects[${match.object.uid}]`,
        message: `GDD explicitly requires object "${contract.object}"${source} to include component "${component}", but GDF components are [${actual.map((name) => `"${name}"`).join(", ")}].`
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: extracted.warnings,
    contracts: extracted.contracts
  };
}

function flattenObjects(gdf) {
  const rows = [];
  for (const scene of gdf.scenes ?? []) {
    for (const object of scene.gameObjects ?? []) {
      rows.push({
        scene_name: scene.scene_name,
        object
      });
    }
  }
  return rows;
}

function findMatchingObjects(rows, objectName) {
  const exactName = rows.filter((row) => row.object?.name === objectName);
  if (exactName.length > 0) return exactName;

  const exactUid = rows.filter((row) => row.object?.uid === objectName);
  if (exactUid.length > 0) return exactUid;

  const normalized = normalizeName(objectName);
  return rows.filter((row) =>
    normalizeName(row.object?.name) === normalized ||
    normalizeName(row.object?.uid) === normalized
  );
}

function componentNames(object) {
  return (object.components ?? [])
    .map((component) => typeof component === "string" ? component : component?.name)
    .filter(Boolean);
}

function normalizeName(value) {
  return String(value ?? "").toLowerCase().replace(/[\s_-]+/g, "");
}
