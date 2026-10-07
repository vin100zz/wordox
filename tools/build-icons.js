// Développement uniquement : npm install --no-save --package-lock=false sharp
// Les PNG générés sont versionnés ; aucune dépendance n'est requise sur le serveur.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const directory = path.join(__dirname, '..', 'icons');

async function main() {
    const icon = fs.readFileSync(path.join(directory, 'icon.svg'), 'utf8');
    const favicon = fs.readFileSync(path.join(directory, 'favicon.svg'));
    // Tout le motif tient dans la zone sûre circulaire Android (rayon 40 %).
    const maskable = icon.replace('rx="112"', '')
        .replace('  <g transform="rotate(12', '  <g transform="translate(46.08 46.08) scale(.82)">\n  <g transform="rotate(12')
        .replace('</svg>', '</g></svg>');
    for (const size of [192, 512, 180]) {
        const name = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
        await sharp(Buffer.from(icon)).resize(size, size).png().toFile(path.join(directory, name));
    }
    await sharp(Buffer.from(maskable)).resize(512, 512).png()
        .toFile(path.join(directory, 'icon-maskable-512.png'));
    await sharp(favicon).resize(32, 32).png().toFile(path.join(directory, 'favicon-32.png'));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
