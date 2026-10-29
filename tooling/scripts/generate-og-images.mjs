import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sitePublic = path.resolve("apps/site/public");

function escapeXml(unsafe) {
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

function buildSvg({ locale, title, subtitle, eyebrow, tags }) {
  const fontSans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const fontSerif = "Georgia, Cambria, 'Times New Roman', serif";
  const fontMono = "'JetBrains Mono', Menlo, Monaco, Consolas, monospace";

  return `
  <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FAF8F5" />
        <stop offset="100%" stop-color="#F3EFE9" />
      </linearGradient>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#EAE5DC" stroke-width="0.8" opacity="0.6"/>
      </pattern>
    </defs>

    <!-- Background -->
    <rect width="1200" height="630" fill="url(#bg)" />
    <rect width="1200" height="630" fill="url(#grid)" />

    <!-- Outer frame border -->
    <rect x="36" y="36" width="1128" height="558" fill="none" stroke="#DCD6CB" stroke-width="1.5" />

    <!-- Brand mark / Logo (UÖ Monogram) -->
    <g transform="translate(80, 80)">
      <rect width="56" height="56" fill="#18181A" rx="10"/>
      <path d="M 14.56 13.44 L 14.56 29.12 C 14.56 36.96 19.04 40.32 24.08 40.32 C 29.12 40.32 33.6 36.96 33.6 29.12 L 33.6 16.8"
            fill="none" stroke="#FFFFFF" stroke-width="4.76" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 41.44 42.56 L 41.44 26.88 C 41.44 19.04 36.96 15.68 31.92 15.68 C 26.88 15.68 22.4 19.04 22.4 26.88 L 22.4 39.2"
            fill="none" stroke="#FFFFFF" stroke-width="4.76" stroke-linecap="round" stroke-linejoin="round"/>
    </g>

    <!-- Eyebrow -->
    <text x="156" y="114" font-family="${fontMono}" font-size="16" font-weight="600" fill="#6B655B" letter-spacing="2.5">
      ${escapeXml(eyebrow.toUpperCase())}
    </text>

    <!-- Main Title -->
    <text x="80" y="240" font-family="${fontSerif}" font-size="52" font-weight="600" fill="#18181A" letter-spacing="-1">
      ${escapeXml(title[0])}
    </text>
    <text x="80" y="306" font-family="${fontSerif}" font-size="52" font-weight="600" fill="#18181A" letter-spacing="-1">
      ${escapeXml(title[1])}
    </text>

    <!-- Subtitle -->
    <text x="80" y="380" font-family="${fontSans}" font-size="22" font-weight="400" fill="#5A554D" letter-spacing="0">
      ${escapeXml(subtitle)}
    </text>

    <!-- Horizontal divider -->
    <line x1="80" y1="440" x2="1120" y2="440" stroke="#DCD6CB" stroke-width="1.2" />

    <!-- Tech tags -->
    <g transform="translate(80, 480)">
      ${tags.map((tag, i) => {
        const offset = i * 185;
        return `
          <g transform="translate(${offset}, 0)">
            <rect width="170" height="38" fill="#ECE7DE" stroke="#D5CEC2" stroke-width="1" rx="4" />
            <text x="85" y="24" font-family="${fontMono}" font-size="13" font-weight="500" fill="#2E2B27" text-anchor="middle">
              ${escapeXml(tag)}
            </text>
          </g>
        `;
      }).join("")}
    </g>

    <!-- Bottom URL / Location -->
    <text x="1120" y="555" font-family="${fontMono}" font-size="14" font-weight="500" fill="#888175" text-anchor="end" letter-spacing="1">
      uguroezdamar.com · Dortmund, Germany
    </text>
  </svg>
  `;
}

async function run() {
  const enSvg = buildSvg({
    locale: "en",
    eyebrow: "Ugur Özdamar · Full-Stack Software Engineer",
    title: ["I build digital products –", "from concept to operation."],
    subtitle: "TypeScript · React & Next.js · PostgreSQL · Robust Architectures & Scalable APIs",
    tags: ["TypeScript", "Next.js", "PostgreSQL", "Edge APIs", "Cloud & DevOps"],
  });

  const deSvg = buildSvg({
    locale: "de",
    eyebrow: "Ugur Özdamar · Full-Stack Software Engineer",
    title: ["Ich entwickle digitale Produkte –", "von der Idee bis zum Betrieb."],
    subtitle: "TypeScript · React & Next.js · PostgreSQL · Robuste Architekturen & skalierbare APIs",
    tags: ["TypeScript", "Next.js", "PostgreSQL", "Edge APIs", "Cloud & DevOps"],
  });

  await fs.mkdir(sitePublic, { recursive: true });

  const enPng = await sharp(Buffer.from(enSvg)).png({ quality: 95 }).toBuffer();
  await fs.writeFile(path.join(sitePublic, "og-image.png"), enPng);
  console.log("Wrote apps/site/public/og-image.png (", enPng.length, "bytes)");

  const dePng = await sharp(Buffer.from(deSvg)).png({ quality: 95 }).toBuffer();
  await fs.writeFile(path.join(sitePublic, "og-image-de.png"), dePng);
  console.log("Wrote apps/site/public/og-image-de.png (", dePng.length, "bytes)");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
