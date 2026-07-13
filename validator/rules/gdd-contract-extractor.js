// rules/gdd-contract-extractor.js
// Extract only explicit object-component contracts stated in GDD text.

import { componentNames, isComponentToken } from "./component-whitelist.js";

const OBJECT_NAME_RE = "[A-Za-z_][A-Za-z0-9_\\- ]{0,80}";
const PAREN_PAIR_RE = new RegExp(`(?:\\*\\*|\\\`)?(${OBJECT_NAME_RE})(?:\\*\\*|\\\`)?\\s*\\(([^)]{1,240})\\)`, "g");

export function extractGddContracts(gddText) {
  const warnings = [];
  const customScriptNames = extractCustomScriptNames(gddText);
  const contracts = [];
  const seen = new Set();
  const lines = String(gddText ?? "").split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineNumber = i + 1;

    if (!/^\s*\|.*\|\s*$/.test(line)) {
      for (const match of line.matchAll(PAREN_PAIR_RE)) {
        const object = cleanObjectName(match[1]);
        const components = extractComponentTokens(match[2], customScriptNames);
        addContract({ contracts, seen, object, components, lineNumber, extractor: "parenthetical" });
      }

      const colon = line.match(/^\s*(?:[-*]\s*)?(?:\*\*|`)?([A-Za-z_][A-Za-z0-9_\- ]{0,80})(?:\*\*|`)?\s*:\s*(.+)$/);
      if (colon) {
        const object = cleanObjectName(colon[1]);
        if (!/\s/.test(object)) {
          const components = extractComponentTokens(colon[2], customScriptNames);
          addContract({ contracts, seen, object, components, lineNumber, extractor: "colon" });
        }
      }
    }
  }

  for (const contract of extractMarkdownTableContracts(lines, customScriptNames)) {
    addContract({ contracts, seen, ...contract });
  }

  return { contracts, warnings };
}

function extractMarkdownTableContracts(lines, customScriptNames) {
  const contracts = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!/^\s*\|.*\|\s*$/.test(line)) continue;

    const headers = splitTableRow(line).map(normalizeHeader);
    if (!headers.length) continue;
    const objectIdx = headers.findIndex((h) => ["object", "gameobject", "game object", "name", "uid"].includes(h));
    const componentIdx = headers.findIndex((h) => ["component", "components", "required components"].includes(h));
    if (objectIdx < 0 || componentIdx < 0) continue;

    for (let j = i + 1; j < lines.length; j += 1) {
      if (!/^\s*\|.*\|\s*$/.test(lines[j])) break;
      if (/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[j])) continue;

      const cells = splitTableRow(lines[j]);
      const object = cleanObjectName(cells[objectIdx] ?? "");
      const components = extractComponentTokens(cells[componentIdx] ?? "", customScriptNames);
      contracts.push({
        object,
        components,
        lineNumber: j + 1,
        extractor: "markdown_table"
      });
    }
  }

  return contracts;
}

function addContract({ contracts, seen, object, components, lineNumber, extractor }) {
  if (!object || object.length < 2 || components.length === 0) return;

  for (const component of components) {
    const key = `${normalizeName(object)}\u0000${component}`;
    if (seen.has(key)) continue;
    seen.add(key);
    contracts.push({
      object,
      required_components: [component],
      source: { line: lineNumber, extractor }
    });
  }
}

function extractComponentTokens(text, customScriptNames) {
  const tokens = String(text ?? "")
    .split(/[,+/&]|\band\b|\bwith\b/iu)
    .map((token) => token.trim().replace(/^["'`*]+|["'`*.;:]+$/g, ""))
    .filter(Boolean);

  const components = [];
  const seen = new Set();
  for (const token of tokens) {
    if (isRelationSegment(token)) continue;

    for (const component of componentNames()) {
      const spaced = component.replace(/([a-z])([A-Z])/g, "$1\\s+$2").replace("_", "\\s*_?\\s*");
      const pattern = new RegExp(`(^|[^A-Za-z0-9_])${spaced}([^A-Za-z0-9_]|$)`);
      if (pattern.test(token) && !seen.has(component)) {
        seen.add(component);
        components.push(component);
      }
    }

    const compact = token.replace(/\s+/g, "");
    const candidates = [token, compact];
    for (const candidate of candidates) {
      if (isComponentToken(candidate, customScriptNames) && !seen.has(candidate)) {
        seen.add(candidate);
        components.push(candidate);
        break;
      }
    }
  }
  return components;
}

function isRelationSegment(token) {
  return /\b(outside|inside|within|under|above|below|behind|in front of|child of|children of|parent|root)\b/i.test(token);
}

function extractCustomScriptNames(gddText) {
  const names = new Set();
  const lines = String(gddText ?? "").split(/\r?\n/);
  for (const line of lines) {
    if (!/custom\s+scripts?|script\s+components?|controller|manager|view/i.test(line)) continue;
    for (const match of line.matchAll(/\b[A-Z][A-Za-z0-9_]*(?:Behaviour|Behavior|Controller|Manager|System|View)\b/g)) {
      names.add(match[0]);
    }
  }
  return names;
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim().replace(/^`|`$/g, "").replace(/^\*\*|\*\*$/g, ""));
}

function normalizeHeader(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ");
}

function cleanObjectName(value) {
  let cleaned = String(value ?? "")
    .trim()
    .replace(/^[-*]\s*/, "")
    .replace(/^["'`*]+|["'`*.;:]+$/g, "")
    .trim();
  const explicitSeparators = [" - ", " -- ", " — ", " – ", ":", ";"];
  for (const separator of explicitSeparators) {
    if (cleaned.includes(separator)) {
      cleaned = cleaned.split(separator).at(-1).trim();
    }
  }
  return cleaned;
}

function normalizeName(value) {
  return String(value ?? "").toLowerCase().replace(/[\s_-]+/g, "");
}
