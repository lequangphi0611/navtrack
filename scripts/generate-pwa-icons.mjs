// Regenerate PWA icon PNGs from the LogoMark design (src/components/Logo/LogoMark.tsx).
// Run manually after changing brand colors/mark: `pnpm icons:generate`.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ImageResponse } from "next/og.js";

const outDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "icons",
);

const GRADIENT = "linear-gradient(150deg, #8b9bff, #2fc6ad)";

// Mirrors LogoMark's two-triangle glyph (viewBox 0 0 100 100).
function glyph(glyphSize) {
  return {
    type: "svg",
    props: {
      width: glyphSize,
      height: glyphSize,
      viewBox: "0 0 100 100",
      children: [
        {
          type: "path",
          props: {
            d: "M50 16 L27 82 L50 67 Z",
            fill: "#07080b",
            fillOpacity: 0.92,
          },
        },
        {
          type: "path",
          props: {
            d: "M50 16 L73 82 L50 67 Z",
            fill: "#07080b",
            fillOpacity: 0.6,
          },
        },
      ],
    },
  };
}

function mark({ canvas, glyphRatio, radius }) {
  return {
    type: "div",
    props: {
      style: {
        width: canvas,
        height: canvas,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: GRADIENT,
        borderRadius: radius,
      },
      children: glyph(Math.round(canvas * glyphRatio)),
    },
  };
}

async function renderIcon(fileName, { canvas, glyphRatio, radius = 0 }) {
  const image = new ImageResponse(mark({ canvas, glyphRatio, radius }), {
    width: canvas,
    height: canvas,
  });
  const buffer = Buffer.from(await image.arrayBuffer());
  await writeFile(path.join(outDir, fileName), buffer);
  console.log(`wrote ${fileName} (${buffer.length} bytes)`);
}

await mkdir(outDir, { recursive: true });

// "any" icons: same 30%-rounded mark as the in-app LogoMark.
await renderIcon("icon-192.png", {
  canvas: 192,
  glyphRatio: 0.56,
  radius: 192 * 0.3,
});
await renderIcon("icon-512.png", {
  canvas: 512,
  glyphRatio: 0.56,
  radius: 512 * 0.3,
});

// "maskable" icon: full-bleed square, glyph shrunk to sit inside Android's
// centered safe-zone circle (~80% of canvas) so masking never clips it.
await renderIcon("icon-512-maskable.png", {
  canvas: 512,
  glyphRatio: 0.34,
  radius: 0,
});

// Apple touch icon: full-bleed square — iOS applies its own corner rounding.
await renderIcon("apple-touch-icon.png", {
  canvas: 180,
  glyphRatio: 0.56,
  radius: 0,
});
