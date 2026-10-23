'use strict';

// Preparação de tamanhos da arte já editada por Image Gen; não redesenha a marca.
// NODE_PATH deve apontar para o runtime compartilhado que contém sharp.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

async function main() {
  const source = process.argv[2];
  if (!source) throw new Error('Uso: node scripts/build-brand-assets.cjs CAMINHO_DA_ARTE.png');
  const root = path.resolve(__dirname, '..');
  const input = await fs.readFile(path.resolve(source));
  const metadata = await sharp(input).metadata();
  if (metadata.width !== metadata.height || metadata.width < 512) throw new Error('A arte precisa ser quadrada e ter pelo menos 512 pixels.');
  const background = '#111315';
  const logo = await sharp(input).resize(512, 512, {fit: 'contain'}).png().toBuffer();
  const icon512 = await sharp(logo).flatten({background}).png().toBuffer();
  const icon192 = await sharp(input).resize(192, 192, {fit: 'contain'}).flatten({background}).png().toBuffer();
  // 280 px de lado => mesmo os cantos cabem no círculo seguro de raio 204,8 px.
  const maskableArt = await sharp(input).resize(280, 280, {fit: 'contain'}).png().toBuffer();
  const maskable = await sharp({create: {width: 512, height: 512, channels: 4, background}})
    .composite([{input: maskableArt, gravity: 'center'}]).png().toBuffer();
  const assets = {'logo.png': logo, 'icon-512.png': icon512, 'icon-192.png': icon192, 'icon-maskable-512.png': maskable};
  await Promise.all(Object.entries(assets).map(([name, data]) => fs.writeFile(path.join(root, name), data)));
  console.log(JSON.stringify({source: path.resolve(source), background, assets: Object.fromEntries(Object.entries(assets).map(([name, data]) => [name, data.length]))}, null, 2));
}

main().catch(error => {console.error(error.message); process.exitCode = 1;});
