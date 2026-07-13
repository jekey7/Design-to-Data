#!/usr/bin/env node

import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { validate, validateWithGddContract } from "../validator/validator.js";

function usage() {
  return `Usage:
  node tools/d2d-cli.mjs validate --gdf <file> [--gdd <file>]
  node tools/d2d-cli.mjs build --gdf <draft.json> --gdd <gdd.md> --unity-project <dir> --unity-exe <Unity.exe> [--destination Assets/D2D/GDF.json]
  node tools/d2d-cli.mjs export --unity-project <dir> --unity-exe <Unity.exe> [--rgdf-dir Assets/D2D/RGdf]`;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (key === "--help" || key === "-h") return { command: "help", options: {} };
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${key} requires a value.`);
    options[key.slice(2)] = value;
    index += 1;
  }
  return { command, options };
}

function requireOption(options, name) {
  if (!options[name]) throw new Error(`Missing required option --${name}.`);
  return options[name];
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Cannot parse JSON '${path}': ${error.message}`);
  }
}

async function validateFile(gdfPath, gddPath) {
  const absoluteGdf = resolve(gdfPath);
  if (!existsSync(absoluteGdf)) throw new Error(`GDF file not found: ${absoluteGdf}`);
  const gdf = readJson(absoluteGdf);
  if (!gddPath) return { result: validate(gdf), absoluteGdf };

  const absoluteGdd = resolve(gddPath);
  if (!existsSync(absoluteGdd)) throw new Error(`GDD file not found: ${absoluteGdd}`);
  return {
    result: await validateWithGddContract(gdf, await readFile(absoluteGdd, "utf8")),
    absoluteGdf
  };
}

function printResult(result) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function requireAssetDestination(unityProject, destination) {
  if (!destination.startsWith("Assets/")) throw new Error("--destination must be an Assets-relative path.");
  const project = resolve(unityProject);
  const output = resolve(project, destination);
  const outputRelative = relative(project, output);
  if (outputRelative.startsWith("..") || isAbsolute(outputRelative)) {
    throw new Error("--destination resolves outside the Unity project.");
  }
  return { project, output };
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function promoteValidatedFile(source, output) {
  mkdirSync(dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.tmp`;
  copyFileSync(source, temporary);
  if (sha256(source) !== sha256(temporary)) {
    rmSync(temporary, { force: true });
    throw new Error("Validated GDF copy did not match the source bytes.");
  }
  rmSync(output, { force: true });
  renameSync(temporary, output);
  if (sha256(source) !== sha256(output)) throw new Error("Promoted GDF does not match the validated source bytes.");
}

function runUnity(unityExe, args) {
  if (!existsSync(unityExe)) throw new Error(`Unity executable not found: ${unityExe}`);
  const execution = spawnSync(unityExe, args, { stdio: "inherit" });
  if (execution.error) throw new Error(`Unable to start Unity: ${execution.error.message}`);
  if (execution.status !== 0) throw new Error(`Unity exited with status ${execution.status}.`);
}

function findLatestRgdf(directory) {
  if (!existsSync(directory)) throw new Error(`R-GDF directory not found: ${directory}`);
  const files = readdirSync(directory)
    .filter((name) => /^R-GDF_.*\.json$/i.test(name))
    .map((name) => join(directory, name))
    .filter((path) => lstatSync(path).isFile())
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
  if (files.length === 0) throw new Error(`No R-GDF JSON file found in ${directory}`);
  return files[0];
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (!command || command === "help") {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  if (command === "validate") {
    const { result } = await validateFile(requireOption(options, "gdf"), options.gdd);
    printResult(result);
    if (!result.valid) process.exitCode = 1;
    return;
  }

  if (command === "build") {
    const { result, absoluteGdf } = await validateFile(requireOption(options, "gdf"), requireOption(options, "gdd"));
    printResult(result);
    if (!result.valid) {
      process.exitCode = 1;
      return;
    }

    const destination = options.destination ?? "Assets/D2D/GDF.json";
    const { project, output } = requireAssetDestination(requireOption(options, "unity-project"), destination);
    promoteValidatedFile(absoluteGdf, output);
    runUnity(requireOption(options, "unity-exe"), [
      "-batchmode", "-nographics", "-projectPath", project,
      "-executeMethod", "D2D.Editor.GdfBuilder.BuildFromCLI",
      "-gdfPath", destination, "-quit"
    ]);
    printResult({ valid: true, promoted_gdf: output, unity_build: "passed" });
    return;
  }

  if (command === "export") {
    const project = resolve(requireOption(options, "unity-project"));
    runUnity(requireOption(options, "unity-exe"), [
      "-batchmode", "-nographics", "-projectPath", project,
      "-executeMethod", "D2D.Editor.RGdfExtractor.ExtractFromCLI", "-quit"
    ]);
    const rgdf = findLatestRgdf(resolve(project, options["rgdf-dir"] ?? "Assets/D2D/RGdf"));
    const { result } = await validateFile(rgdf);
    printResult({ rgdf, ...result });
    if (!result.valid) process.exitCode = 1;
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  process.stderr.write(`D2D CLI error: ${error.message}\n${usage()}\n`);
  process.exitCode = 1;
});
