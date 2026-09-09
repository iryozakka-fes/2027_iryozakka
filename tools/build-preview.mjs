/**
 * 画像を全部 data URI で埋め込んだ「1枚だけのHTML」を作る。
 *
 * 職場や外出先から見た目を確認したいときに使う。サーバーへのアップロードも
 * 公開も要らず、ファイル1つを開けばそのまま表示される。
 *
 *   node tools/build-preview.mjs
 *   → preview-standalone.html （Git対象外）
 *
 * 本番にアップするのは index.html + img2027/ のほう。これは確認専用。
 */
import { readFileSync, writeFileSync, statSync } from "node:fs";

const SRC = "index.html";
const OUT = "preview-standalone.html";

let html = readFileSync(SRC, "utf8");

const cache = new Map();
const toDataUri = (path) => {
  if (cache.has(path)) return cache.get(path);
  const ext = path.split(".").pop().toLowerCase();
  const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml", webp: "image/webp" }[ext];
  if (!mime) throw new Error(`未対応の拡張子: ${path}`);
  const uri = `data:${mime};base64,${readFileSync(path).toString("base64")}`;
  cache.set(path, uri);
  return uri;
};

// src="img2027/..." と url("img2027/...") の両方を差し替える
const found = new Set();
html = html.replace(/(src="|url\(")(img2027\/[^"]+)(")/g, (_m, pre, path, post) => {
  found.add(path);
  return pre + toDataUri(path) + post;
});

// og:image は絶対URLなので触らない（差し替えるとタグが壊れるだけ）
writeFileSync(OUT, html);

const kb = Math.round(statSync(OUT).size / 1024);
console.log(`${OUT}  ${kb}KB`);
console.log(`埋め込んだ画像 ${found.size}点:`);
for (const f of [...found].sort()) console.log(`  ${f}`);
