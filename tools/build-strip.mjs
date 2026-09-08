/**
 * ヘッダー・フッターに敷くアイコン帯（img2027/icon/strip.png）を組み立てる。
 *
 * 帯は1枚の画像を CSS の repeat-x で敷き詰めているので、
 * アイコンを足す・外す・順番を変えたときはこれを実行して作り直すこと。
 *
 *   npm install sharp     （初回のみ）
 *   node tools/build-strip.mjs
 *
 * ORDER は医療モチーフと雑貨モチーフを交互に並べている。
 * 両端は間隔の半分ずつにしてあるので、繰り返しても継ぎ目が均等に見える。
 */
import sharp from "sharp";
import { readFileSync, statSync } from "node:fs";

const ICON_DIR = "img2027/icon";
const OUT = `${ICON_DIR}/strip.png`;

const HEIGHT = 120; // 帯の内部解像度。CSS側は background-size:auto 100% で縮めて使う
const GAP = 26; // アイコン同士の間隔

// 医 → 雑 → 医 → 雑 … の順。ロゴにある「医」「ざ」「×」は入れない
const ORDER = [
  "syringe", // 医
  "notebook", // 雑
  "eyedrops", // 医
  "mug", // 雑
  "bandage", // 医
  "pencil", // 雑
  "capsule", // 医
  "clips", // 雑
];

const parts = [];
for (const name of ORDER) {
  const buf = await sharp(`${ICON_DIR}/${name}.png`).resize({ height: HEIGHT }).toBuffer();
  const { width } = await sharp(buf).metadata();
  parts.push({ name, buf, width });
}

const total = parts.reduce((sum, p) => sum + p.width, 0) + GAP * ORDER.length;

let x = Math.round(GAP / 2); // 左端は間隔の半分から始める
const layers = parts.map((p) => {
  const layer = { input: p.buf, left: x, top: 0 };
  x += p.width + GAP;
  return layer;
});

await sharp({
  create: { width: total, height: HEIGHT, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite(layers)
  .png({ compressionLevel: 9, palette: true })
  .toFile(OUT);

const kb = Math.round(statSync(OUT).size / 1024);
console.log(`${OUT}  ${total}x${HEIGHT}  ${kb}KB`);
console.log(parts.map((p) => `${p.name}(${p.width})`).join(" "));
