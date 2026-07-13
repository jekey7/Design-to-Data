// run.js
import { validate, validateWithGddContract } from "./validator.js";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, resolve } from "path";

const GDF_DIR = "./gdf";

function resolveGdfPath(arg) {
  if (arg) return resolve(arg);

  if (!existsSync(GDF_DIR)) {
    console.error(`Error: '${GDF_DIR}' folder not found. Pass a file path as argument or place GDF files in '${GDF_DIR}/'.`);
    process.exit(1);
  }

  const files = readdirSync(GDF_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.error(`Error: No JSON files found in '${GDF_DIR}'. Pass a file path as argument or add GDF files to '${GDF_DIR}/'.`);
    process.exit(1);
  }
  if (files.length > 1) {
    console.error(`Multiple GDF files found in '${GDF_DIR}':\n${files.map((f) => `  ${f}`).join("\n")}\nSpecify one: node run.js <path>`);
    process.exit(1);
  }

  return resolve(join(GDF_DIR, files[0]));
}

function parseArgs(argv) {
  const args = { gdfPath: null, gddPath: null };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      console.error("Usage: node run.js [gdf.json] [--gdd gdd.md]");
      process.exit(0);
    }
    if (arg === "--gdd") {
      if (i + 1 >= argv.length) {
        console.error("Error: --gdd requires a file path.");
        process.exit(1);
      }
      args.gddPath = resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      console.error(`Error: Unknown option '${arg}'.`);
      process.exit(1);
    }
    if (args.gdfPath) {
      console.error(`Error: Multiple GDF paths provided: '${args.gdfPath}' and '${arg}'.`);
      process.exit(1);
    }
    args.gdfPath = arg;
  }
  return args;
}

const args = parseArgs(process.argv);
const gdfPath = resolveGdfPath(args.gdfPath);
console.error(`Validating: ${gdfPath}`);
if (args.gddPath) {
  console.error(`Checking GDD contracts: ${args.gddPath}`);
}

const gdf = JSON.parse(readFileSync(gdfPath, "utf-8"));
const result = args.gddPath
  ? await validateWithGddContract(gdf, readFileSync(args.gddPath, "utf-8"))
  : validate(gdf);

console.log(JSON.stringify(result, null, 2));
