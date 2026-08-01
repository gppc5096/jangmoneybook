const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// 가계부(ledger) + 거래 추가(+)를 나타내는 브랜드 컬러(#2B5BE2) 아이콘.
const SOURCE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="110" fill="#2B5BE2"/>
  <rect x="120" y="90" width="220" height="332" rx="22" fill="#FFFFFF"/>
  <rect x="150" y="150" width="160" height="18" rx="9" fill="#2B5BE2" opacity="0.9"/>
  <rect x="150" y="200" width="160" height="18" rx="9" fill="#2B5BE2" opacity="0.6"/>
  <rect x="150" y="250" width="110" height="18" rx="9" fill="#2B5BE2" opacity="0.6"/>
  <circle cx="372" cy="372" r="74" fill="#FFC94A" stroke="#FFFFFF" stroke-width="10"/>
  <rect x="344" y="363" width="56" height="18" rx="9" fill="#FFFFFF"/>
  <rect x="363" y="344" width="18" height="56" rx="9" fill="#FFFFFF"/>
</svg>
`;

async function main() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const svgPath = path.join(PUBLIC_DIR, 'favicon.svg');
  fs.writeFileSync(svgPath, SOURCE_SVG);

  const svgBuffer = Buffer.from(SOURCE_SVG);

  await sharp(svgBuffer, { density: 384 })
    .resize(32, 32)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'favicon-32.png'));

  await sharp(svgBuffer, { density: 384 })
    .resize(180, 180)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));

  await sharp(svgBuffer, { density: 384 })
    .resize(192, 192)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'icon-192.png'));

  await sharp(svgBuffer, { density: 384 })
    .resize(512, 512)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'icon-512.png'));

  console.log(
    'Generated public/favicon.svg, favicon-32.png, apple-touch-icon.png, icon-192.png, icon-512.png',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
