const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const pngToIco = require("png-to-ico");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_ICON = path.join(ROOT, "HexoGUI.png");
const BUILD_DIR = path.join(ROOT, "build");
const OUTPUT_ICO = path.join(BUILD_DIR, "icon.ico");
const TEMP_DIR = path.join(BUILD_DIR, "icon-sizes");
const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256];

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function buildIcon() {
  if (!fs.existsSync(SOURCE_ICON)) {
    throw new Error(`Icon source not found: ${SOURCE_ICON}`);
  }

  await ensureDir(BUILD_DIR);
  await ensureDir(TEMP_DIR);

  const resizedPngPaths = [];
  for (const size of ICON_SIZES) {
    const outPath = path.join(TEMP_DIR, `${size}.png`);

    await sharp(SOURCE_ICON)
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toFile(outPath);

    resizedPngPaths.push(outPath);
  }

  const icoBuffer = await pngToIco(resizedPngPaths);
  await fs.promises.writeFile(OUTPUT_ICO, icoBuffer);

  console.log(`Generated icon: ${OUTPUT_ICO}`);
  console.log(`Included sizes: ${ICON_SIZES.join(", ")}`);
}

buildIcon().catch((err) => {
  console.error(err);
  process.exit(1);
});
