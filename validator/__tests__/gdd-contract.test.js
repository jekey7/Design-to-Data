import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { extractGddContracts } from "../rules/gdd-contract-extractor.js";
import { validateWithGddContract } from "../validator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFixture(dir, file) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, dir, file), "utf-8"));
}

describe("GDD explicit component contract extraction", () => {
  test("extracts parenthetical, table, inline, and colon contracts", () => {
    const gdd = `
- **BackgroundImage** (Image, full-screen, behind all elements)
MainMenuCanvas (Canvas + CanvasScaler + GraphicRaycaster) with children - GameLogoImage (Image)

| Object | Components |
| --- | --- |
| PlayButton | Image + Button |

ScoreText: TextMeshProUGUI
DecorativePanel (full-screen background)
`;

    const result = extractGddContracts(gdd);
    const pairs = result.contracts.map((c) => `${c.object}:${c.required_components[0]}`);

    expect(pairs).toContain("BackgroundImage:Image");
    expect(pairs).toContain("MainMenuCanvas:Canvas");
    expect(pairs).toContain("MainMenuCanvas:CanvasScaler");
    expect(pairs).toContain("MainMenuCanvas:GraphicRaycaster");
    expect(pairs).toContain("GameLogoImage:Image");
    expect(pairs).toContain("PlayButton:Image");
    expect(pairs).toContain("PlayButton:Button");
    expect(pairs).toContain("ScoreText:TextMeshProUGUI");
    expect(pairs.some((pair) => pair.startsWith("DecorativePanel:"))).toBe(false);
  });
});

describe("GDD explicit component contract validation", () => {
  test("passes when explicit GDD contracts are preserved in GDF", async () => {
    const gdf = loadFixture("valid", "valid_full_hud.json");
    const gdd = `
- **BackgroundImage** (Image, full-screen)
- **PlayButton** (Image + Button)
- **MenuCanvas** (Canvas + CanvasScaler + GraphicRaycaster)
`;

    const result = await validateWithGddContract(gdf, gdd);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.checks.gds.valid).toBe(true);
    expect(result.checks.contract.valid).toBe(true);
  });

  test("fails when GDF passes GDS validation but violates an explicit GDD component contract", async () => {
    const gdf = loadFixture("valid", "valid_full_hud.json");
    const background = gdf.scenes[0].gameObjects.find((go) => go.name === "BackgroundImage");
    background.components = [
      {
        name: "CanvasGroup",
        isCustomScript: false,
        properties: {
          alpha: 1
        }
      }
    ];

    const result = await validateWithGddContract(gdf, "- **BackgroundImage** (Image, full-screen)");

    expect(result.valid).toBe(false);
    expect(result.checks.gds.valid).toBe(true);
    expect(result.checks.contract.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "GDD_CONTRACT_MISSING_COMPONENT")).toBe(true);
  });

  test("uses normalized exact object matching without fuzzy matching", async () => {
    const gdf = loadFixture("valid", "valid_full_hud.json");
    const result = await validateWithGddContract(gdf, "- **obj_img_bg** (Image)");

    expect(result.valid).toBe(true);
    expect(result.checks.contract.valid).toBe(true);
  });
});
