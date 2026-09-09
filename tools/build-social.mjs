/**
 * SNS投稿用の画像を書き出す。
 *
 *   npm install sharp        （初回のみ）
 *   node tools/build-social.mjs
 *   → social/instagram-1080x1350.png / social/x-1200x675.png
 *
 * サイト(index.html)と同じ色・書体・部品で組んでいるので、
 * 並べたときにトーンが揃う。日付や会場が変わったら CONTENT を直して再実行する。
 *
 * 【フォントについて】
 * 日付の丸ゴシック M PLUS Rounded 1c はWindowsに入っていないため、
 * このスクリプトは fonts/ に置いたTTFを fontconfig 経由で読む。
 * FONT_DIR にファイルが無い場合は自動で取得する。システムへのインストールはしない。
 */
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

// ---------------------------------------------------------------- 内容
const CONTENT = {
  badge: "第 3 回  開 催 決 定",
  date: "2027年5月8日(土)",
  venue: "都立産業貿易センター 台東館 4階",
  address: "〒111-0033 東京都台東区花川戸2-6-5",
  catch1: "過去2回の大盛況におこたえして、",
  catch2: "会場がぐんと広くなりました！",
};

// ---------------------------------------------------------------- 色（サイトと同一）
const C = {
  bg: "#fbf4d0",
  gradL: "#9de5e0",
  gradG: "#cff2c9", // くすみ止めの緑
  gradC: "#fbf4d0",
  gradR: "#ffbdb5",
  accent: "#ff7d6d",
  ink: "#304e4c",
  inkSoft: "#5c7a77",
};
const ROUND = "M PLUS Rounded 1c";
const GOTHIC = "BIZ UDPGothic";

const IMG = "img2027";
const OUT_DIR = "social";

// ---------------------------------------------------------------- フォント準備
const FONT_DIR = path.resolve("tools/.fonts");
function ensureFont() {
  const ttf = path.join(FONT_DIR, "MPLUSRounded1c-800.ttf");
  if (!existsSync(ttf) || statSync(ttf).size < 100000) {
    mkdirSync(FONT_DIR, { recursive: true });
    const css = execSync(
      `curl -s -A "Mozilla/5.0" "https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@800"`,
      { encoding: "utf8" }
    );
    const url = css.match(/https:\/\/[^)]*\.ttf/)?.[0];
    if (!url) throw new Error("フォントのURLを取得できなかった");
    execSync(`curl -sL -o "${ttf}" "${url}"`);
    console.log("フォントを取得:", path.basename(ttf));
  }
  const conf = path.join(FONT_DIR, "fonts.conf");
  writeFileSync(
    conf,
    `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig>` +
      `<dir>${FONT_DIR.replace(/\\/g, "/")}</dir><dir>C:/Windows/Fonts</dir>` +
      `<cachedir>${FONT_DIR.replace(/\\/g, "/")}/cache</cachedir></fontconfig>`
  );
  process.env.FONTCONFIG_FILE = conf;
}

// ---------------------------------------------------------------- 部品
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 白い縁つきの文字。librsvg の paint-order に頼らず、縁→塗りの2回描きで確実に出す */
function text({ x, y, size, fill, family = GOTHIC, weight = 700, stroke = 0, content, anchor = "middle" }) {
  const common = `x="${x}" y="${y}" font-family="${family}" font-weight="${weight}" font-size="${size}" text-anchor="${anchor}"`;
  const body = esc(content);
  const outline = stroke
    ? `<text ${common} fill="none" stroke="#fff" stroke-width="${stroke}" stroke-linejoin="round">${body}</text>`
    : "";
  return `${outline}<text ${common} fill="${fill}">${body}</text>`;
}

/** 花びら。位置・大きさ・角度を決め打ちで散らす */
function petals(w, h, n) {
  const seed = [
    [6, 12, 17, -18, 0.9], [18, 34, 10, 28, 0.7], [11, 62, 24, -6, 0.85], [24, 78, 10, 52, 0.6],
    [33, 18, 12, 12, 0.75], [41, 52, 10, -34, 0.65], [47, 86, 31, 20, 0.9], [56, 26, 10, 44, 0.6],
    [63, 66, 14, -12, 0.8], [71, 14, 10, 24, 0.7], [78, 44, 26, -22, 0.88], [84, 72, 10, 38, 0.62],
    [90, 30, 14, 8, 0.75], [95, 58, 10, -42, 0.6], [15, 90, 12, 16, 0.7], [37, 6, 10, -30, 0.65],
    [68, 92, 21, 32, 0.82], [88, 8, 12, -10, 0.72], [52, 10, 10, 46, 0.58], [28, 50, 10, -38, 0.6],
  ];
  return seed
    .slice(0, n)
    .map(([lx, ty, pw, rot, op]) => {
      const cx = (lx / 100) * w, cy = (ty / 100) * h;
      const ph = pw * 0.58;
      // しずく形：角丸の1つだけを立たせる
      return `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${rot})">
        <path d="M0 ${ph} L0 ${ph / 2} A ${pw / 2} ${ph / 2} 0 0 1 ${pw} ${ph / 2}
                 A ${pw / 2} ${ph / 2} 0 0 1 ${pw / 2} ${ph} Z"
              fill="#fff" opacity="${op}"/></g>`;
    })
    .join("");
}

// ---------------------------------------------------------------- 版ごとの設計
const LAYOUTS = {
  "instagram-1080x1350": {
    W: 1080, H: 1350,
    pad: 58,                 // ざぶとんの外側の余白
    panel: { top: 168, bottom: 1188, radius: 46 },
    tape: { h: 86, topY: 34, bottomY: 1230 },
    logoW: 700, logoY: 250,
    badge: { y: 540, size: 30 },
    date: { y: 652, size: 82, stroke: 7 },
    venue: { y: 734, size: 40, stroke: 4 },
    address: { y: 780, size: 25, stroke: 3 },
    catch: { y1: 858, y2: 920, size: 45, stroke: 4 },
    crowd: { baseY: 1215, pio: 280, fig: 92 },
    flowers: [
      { f: "margaret-orange", w: 230, x: -70, y: 120, r: -8 },
      { f: "margaret-white", w: 170, x: 950, y: 300, r: 14 },
      { f: "margaret-white", w: 300, x: -150, y: 620, r: -14 },
      { f: "margaret-orange", w: 260, x: 930, y: 800, r: 20 },
      { f: "margaret-white", w: 200, x: -60, y: 1080, r: -18 },
    ],
  },
  "x-1200x675": {
    W: 1200, H: 675,
    pad: 46,
    panel: { top: 92, bottom: 586, radius: 38 },
    tape: { h: 62, topY: 12, bottomY: 604 },
    logoW: 470, logoY: 118,
    badge: { y: 302, size: 22 },
    date: { y: 376, size: 56, stroke: 5 },
    venue: { y: 428, size: 28, stroke: 3 },
    address: null, // 横長では小さすぎて読めないので省く
    catch: { y1: 490, y2: 530, size: 28, stroke: 3 },
    // 縦に余裕がないので、人だかりは中央に置かず左右の空きに逃がす
    crowdMode: "sides",
    crowd: { baseY: 600, pio: 160, fig: 64 },
    flowers: [
      { f: "margaret-orange", w: 165, x: -50, y: 58, r: -8 },
      { f: "margaret-white", w: 125, x: 1090, y: 150, r: 14 },
      { f: "margaret-white", w: 200, x: -95, y: 320, r: -14 },
      { f: "margaret-orange", w: 175, x: 1075, y: 400, r: 20 },
    ],
  },
};

/**
 * 画面の外にはみ出す位置に画像を置く。
 * sharp の composite は負の座標もキャンバス超えも受け付けないので、
 * はみ出す分をこちらで切り落としてから渡す。
 * （マステも花も「あえて画面外に切る」設計なので、これが要る）
 */
async function placeAt(buf, left, top, W, H) {
  const m = await sharp(buf).metadata();
  const cropL = Math.max(0, -left);
  const cropT = Math.max(0, -top);
  const w = Math.min(m.width - cropL, W - Math.max(0, left));
  const h = Math.min(m.height - cropT, H - Math.max(0, top));
  if (w <= 0 || h <= 0) return null; // 完全に画面外
  const cut =
    cropL || cropT || w !== m.width || h !== m.height
      ? await sharp(buf).extract({ left: cropL, top: cropT, width: w, height: h }).toBuffer()
      : buf;
  return { input: cut, left: Math.max(0, left), top: Math.max(0, top) };
}

// ---------------------------------------------------------------- 組み立て
async function build(name, L) {
  const cx = L.W / 2;
  const panelH = L.panel.bottom - L.panel.top;
  const panelW = L.W - L.pad * 2;

  // 背景＋ざぶとん＋花びら＋文字を1枚のSVGで
  const svg = `<svg width="${L.W}" height="${L.H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0.18">
      <stop offset="0%" stop-color="${C.gradL}"/>
      <stop offset="26%" stop-color="${C.gradG}"/>
      <stop offset="52%" stop-color="${C.gradC}"/>
      <stop offset="100%" stop-color="${C.gradR}"/>
    </linearGradient>
    <clipPath id="panelClip">
      <rect x="${L.pad}" y="${L.panel.top}" width="${panelW}" height="${panelH}" rx="${L.panel.radius}"/>
    </clipPath>
  </defs>
  <!-- 全面の背景はここでは描かない。下地に置いた背面の花を塗りつぶしてしまうため -->
  <rect x="${L.pad}" y="${L.panel.top}" width="${panelW}" height="${panelH}" rx="${L.panel.radius}" fill="url(#g)"/>
  <g clip-path="url(#panelClip)" transform="translate(${L.pad} ${L.panel.top})">
    ${petals(panelW, panelH, 20)}
  </g>
  ${(() => {
    // バッジ：左右にコーラルの短い罫線
    const b = L.badge, half = b.size * 5.2, gap = b.size * 0.9, rule = b.size * 1.5;
    return `<rect x="${cx - half - gap - rule}" y="${b.y - b.size * 0.42}" width="${rule}" height="${Math.max(3, b.size * 0.13)}" rx="2" fill="${C.accent}"/>
            <rect x="${cx + half + gap}" y="${b.y - b.size * 0.42}" width="${rule}" height="${Math.max(3, b.size * 0.13)}" rx="2" fill="${C.accent}"/>
            ${text({ x: cx, y: b.y, size: b.size, fill: C.ink, family: ROUND, weight: 800, content: CONTENT.badge })}`;
  })()}
  ${text({ x: cx, y: L.date.y, size: L.date.size, fill: C.accent, family: ROUND, weight: 800, stroke: L.date.stroke, content: CONTENT.date })}
  ${text({ x: cx, y: L.venue.y, size: L.venue.size, fill: C.ink, stroke: L.venue.stroke, content: CONTENT.venue })}
  ${L.address ? text({ x: cx, y: L.address.y, size: L.address.size, fill: C.inkSoft, stroke: L.address.stroke, content: CONTENT.address }) : ""}
  ${text({ x: cx, y: L.catch.y1, size: L.catch.size, fill: C.ink, family: ROUND, weight: 800, stroke: L.catch.stroke, content: CONTENT.catch1 })}
  ${text({ x: cx, y: L.catch.y2, size: L.catch.size, fill: C.accent, family: ROUND, weight: 800, stroke: L.catch.stroke, content: CONTENT.catch2 })}
</svg>`;

  const layers = [];

  // --- 背面のマーガレット（ざぶとんの下に潜らせたいので、下地の直後に置く）
  for (const fl of L.flowers) {
    const buf = await sharp(`${IMG}/art/${fl.f}.png`).resize({ width: fl.w }).rotate(fl.r, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
    const p = await placeAt(buf, Math.round(fl.x), Math.round(fl.y), L.W, L.H);
    if (p) layers.push(p);
  }

  const base = await sharp({ create: { width: L.W, height: L.H, channels: 4, background: C.bg } })
    .composite(layers)
    .png()
    .toBuffer();

  // --- ざぶとん＋文字（花はこの下に隠れる＝サイトと同じ前後関係）
  const withPanel = await sharp(base).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();

  const top = [];

  // --- マステ（上下）
  const stripMeta = await sharp(`${IMG}/icon/strip.png`).metadata();
  const tapeInner = Math.round(L.tape.h * 0.58);
  const stripW = Math.round((stripMeta.width * tapeInner) / stripMeta.height);
  const tapeW = L.W + 120;
  for (const [y, rot] of [[L.tape.topY, -0.7], [L.tape.bottomY, 0.28]]) {
    const tiles = [];
    for (let x = 0; x < tapeW; x += stripW) {
      tiles.push({ input: await sharp(`${IMG}/icon/strip.png`).resize({ height: tapeInner }).toBuffer(), left: x, top: Math.round((L.tape.h - tapeInner) / 2) });
    }
    const tape = await sharp({ create: { width: tapeW, height: L.tape.h, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0.72 } } })
      .composite(tiles).png().toBuffer();
    const rotated = await sharp(tape).rotate(rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
    const rm = await sharp(rotated).metadata();
    const p = await placeAt(rotated, Math.round((L.W - rm.width) / 2), Math.round(y - (rm.height - L.tape.h) / 2), L.W, L.H);
    if (p) top.push(p);
  }

  // --- ロゴ
  const logo = await sharp(`${IMG}/logo-2027.png`).resize({ width: L.logoW }).toBuffer();
  top.push({ input: logo, left: Math.round(cx - L.logoW / 2), top: L.logoY });

  // --- 人だかり。ぴおすんを主役に、来場者の線画を脇に。
  // 縦長は中央に一列（サイトと同じ）、横長は縦の余裕がないので左右の空きに逃がす。
  const figs = [];
  for (const c of [
    { f: "art/mamatoko", h: L.crowd.fig },
    { f: "art/chibicos", h: Math.round(L.crowd.fig * 0.81) },
    { f: "piosun", h: L.crowd.pio },
    { f: "art/hiyorinmioshin", h: L.crowd.fig },
    { f: "art/pregnant-pair", h: L.crowd.fig },
  ]) {
    const b = await sharp(`${IMG}/${c.f}.png`).resize({ height: c.h }).toBuffer();
    figs.push({ b, w: (await sharp(b).metadata()).width, h: c.h, pio: c.f === "piosun" });
  }
  const lift = Math.round(L.crowd.fig * 0.22); // 下端から少しはみ出させる量

  if (L.crowdMode === "sides") {
    const pio = figs.find((f) => f.pio);
    const left = figs.filter((f) => !f.pio).slice(0, 2);
    const right = figs.filter((f) => !f.pio).slice(2);
    const gap = Math.round(L.crowd.fig * 0.3);
    // 右端にぴおすん
    top.push(await placeAt(pio.b, L.W - L.pad - pio.w - 18, L.crowd.baseY - pio.h + lift, L.W, L.H));
    // 左端に2人
    let lx = L.pad + 24;
    for (const f of left) { top.push(await placeAt(f.b, lx, L.crowd.baseY - f.h + lift, L.W, L.H)); lx += f.w + gap; }
    // 右のぴおすんの手前に1人
    let rx = L.W - L.pad - pio.w - 18 - gap;
    for (const f of right) { rx -= f.w; top.push(await placeAt(f.b, rx, L.crowd.baseY - f.h + lift, L.W, L.H)); rx -= gap; }
  } else {
    const gap = Math.round(L.crowd.fig * 0.35);
    const totalW = figs.reduce((s2, p) => s2 + p.w, 0) + gap * (figs.length - 1);
    let x = Math.round(cx - totalW / 2);
    for (const p of figs) { top.push(await placeAt(p.b, x, Math.round(L.crowd.baseY - p.h + lift), L.W, L.H)); x += p.w + gap; }
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const out = `${OUT_DIR}/${name}.png`;
  await sharp(withPanel).composite(top.filter(Boolean)).png({ compressionLevel: 9 }).toFile(out);
  console.log(`${out}  ${L.W}x${L.H}  ${Math.round(statSync(out).size / 1024)}KB`);
}

ensureFont();
for (const [name, L] of Object.entries(LAYOUTS)) await build(name, L);
