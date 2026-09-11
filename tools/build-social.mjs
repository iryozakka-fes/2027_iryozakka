/**
 * SNS投稿用の画像を書き出す。
 *
 *   npm install sharp        （初回のみ）
 *   node tools/build-social.mjs
 *
 * 出力（social/）
 *   instagram-1080x1350.png       … 文字を仮あてした版。配置を見るためのもの
 *   instagram-1080x1350-plain.png … 文字なしの台紙。ソフトで文字を組む用
 *   x-1200x675.png                … 文字入りの完成版
 *
 * 【媒体で作りを変えている】
 * Instagram は使っている書体が別（UDPゴシックは使っていない）で、カーニングも
 * ソフトで詰めたいので、文字なしの台紙を出して組んでもらう。
 * X は Web のティザーへ飛ばす導線であり Web 側も X へ誘導しているので、
 * 往復したときに同じ顔になるよう Web と同じ書体で文字を焼き込む。
 *
 * 【Webのレイアウトをそのまま流用しない】
 * Web は「クリーム地の上にグラデの面が乗る」構造だが、SNS画像はそれ自体が
 * メインビジュアルなのでグラデを全面に敷く。額縁が無いぶん強く出る。
 * マステも Web のように上下の帯にはせず、背面に斜めに敷いて賑やかしにする。
 *
 * 【フォント】
 * 丸ゴシック M PLUS Rounded 1c はWindowsに無いためTTFを自動取得し、
 * fontconfig 経由で読む。システムへのインストールはしない。
 */
import sharp from "sharp";
import { writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

// ---------------------------------------------------------------- 内容
const CONTENT = {
  badge: "第 3 回  開 催 決 定",
  date: "2027年5月8日(土)",
  venue: "都立産業貿易センター 台東館 4階",
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

// ---------------------------------------------------------------- フォント
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
  const p = (x) => x.replace(/\\/g, "/");
  writeFileSync(
    conf,
    `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig>` +
      `<dir>${p(FONT_DIR)}</dir><dir>C:/Windows/Fonts</dir>` +
      `<cachedir>${p(FONT_DIR)}/cache</cachedir></fontconfig>`
  );
  process.env.FONTCONFIG_FILE = conf;
}

// ---------------------------------------------------------------- 小物
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 白い縁つきの文字。librsvg の paint-order に頼らず、縁→塗りの2回描きで確実に出す */
function text({ x, y, size, fill, family = GOTHIC, weight = 700, stroke = 0, content, spacing = 0 }) {
  const attr = `x="${x}" y="${y}" font-family="${family}" font-weight="${weight}" font-size="${size}" text-anchor="middle" letter-spacing="${spacing}"`;
  const body = esc(content);
  const outline = stroke
    ? `<text ${attr} fill="none" stroke="#fff" stroke-width="${stroke}" stroke-linejoin="round">${body}</text>`
    : "";
  return `${outline}<text ${attr} fill="${fill}">${body}</text>`;
}

/**
 * 画面の外にはみ出す位置に画像を置く。
 * sharp の composite は負の座標もキャンバス超えも受け付けないが、
 * マステも花も「あえて画面外に切る」設計なので、はみ出す分をここで切り落とす。
 */
async function placeAt(buf, left, top, W, H) {
  const m = await sharp(buf).metadata();
  const cropL = Math.max(0, -left);
  const cropT = Math.max(0, -top);
  const w = Math.min(m.width - cropL, W - Math.max(0, left));
  const h = Math.min(m.height - cropT, H - Math.max(0, top));
  if (w <= 0 || h <= 0) return null;
  const cut =
    cropL || cropT || w !== m.width || h !== m.height
      ? await sharp(buf).extract({ left: cropL, top: cropT, width: w, height: h }).toBuffer()
      : buf;
  return { input: cut, left: Math.max(0, left), top: Math.max(0, top) };
}

/** 舞う花びら（しずく形）。位置・大きさ・角度は決め打ちで、毎回同じ絵になる */
function petals(W, H) {
  const seed = [
    [5, 10, 26, -18, 0.85], [17, 30, 15, 28, 0.6], [10, 58, 34, -6, 0.8], [23, 74, 14, 52, 0.55],
    [31, 16, 18, 12, 0.7], [39, 48, 14, -34, 0.6], [45, 82, 44, 20, 0.85], [54, 24, 15, 44, 0.55],
    [61, 62, 21, -12, 0.75], [69, 12, 14, 24, 0.65], [76, 40, 38, -22, 0.82], [82, 68, 14, 38, 0.58],
    [88, 27, 21, 8, 0.7], [93, 54, 14, -42, 0.55], [14, 86, 18, 16, 0.65], [35, 5, 14, -30, 0.6],
    [66, 90, 30, 32, 0.78], [86, 7, 18, -10, 0.68], [50, 8, 14, 46, 0.55], [27, 46, 14, -38, 0.55],
    [72, 76, 17, 22, 0.62], [42, 66, 22, -26, 0.68], [95, 84, 15, 12, 0.58], [8, 40, 16, 34, 0.6],
  ];
  return seed
    .map(([lx, ty, pw, rot, op]) => {
      const x = (lx / 100) * W, y = (ty / 100) * H, ph = pw * 0.58;
      return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot})">
        <path d="M0 ${ph} L0 ${ph / 2} A ${pw / 2} ${ph / 2} 0 0 1 ${pw} ${ph / 2}
                 A ${pw / 2} ${ph / 2} 0 0 1 ${pw / 2} ${ph} Z" fill="#fff" opacity="${op}"/></g>`;
    })
    .join("");
}

/** 背面に斜めに敷くマステ。上下の帯ではなく賑やかしの地模様として使う */
async function tapeStrip({ len, h, rot, opacity }) {
  const meta = await sharp(`${IMG}/icon/strip.png`).metadata();
  const inner = Math.round(h * 0.58);
  const sw = Math.round((meta.width * inner) / meta.height);
  const tiles = [];
  const one = await sharp(`${IMG}/icon/strip.png`).resize({ height: inner }).toBuffer();
  for (let x = 0; x < len; x += sw) tiles.push({ input: one, left: x, top: Math.round((h - inner) / 2) });
  const flat = await sharp({ create: { width: len, height: h, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0.62 } } })
    .composite(tiles)
    .png()
    .toBuffer();
  const rotated = await sharp(flat).rotate(rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  // 全体の不透明度を下げる。dest-in は「重ねた側の透明度を掛ける」ので、
  // 回転後の実サイズと同じ大きさの半透明な板を用意する必要がある
  const rm = await sharp(rotated).metadata();
  return sharp(rotated)
    .composite([{
      input: { create: { width: rm.width, height: rm.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: opacity } } },
      blend: "dest-in",
    }])
    .png()
    .toBuffer();
}

// ---------------------------------------------------------------- 設計
const LAYOUTS = {
  "instagram-1080x1350": {
    W: 1080, H: 1350,
    // マステは上下の端に寄せる。中央に走らせると文字の地がうるさくなる
    tapes: [
      { len: 1700, h: 92, rot: -11, x: -280, y: 44, opacity: 0.5 },
      { len: 1700, h: 80, rot: 9, x: -220, y: 1148, opacity: 0.42 },
    ],
    // 透かしの白ざぶとん。全面グラデの上に文字を直接置くと地がうるさいので、
    // 文字が乗る範囲だけ白を敷いて読みやすくする。
    // （サイト側では面そのものが情報の地なので白は敷かない。文脈が違う）
    panel: { x: 70, top: 330, w: 940, h: 610, radius: 44, alpha: 0.62 },
    // ロゴはざぶとんの上端をまたぐ。上に少しはみ出させて重なりを作る
    logoW: 760, logoY: 200,
    badge: { y: 480, size: 34, spacing: 3 },
    date: { y: 616, size: 112, stroke: 10 }, // 主役
    venue: { y: 694, size: 40, stroke: 4 },
    catch: { y1: 806, y2: 878, size: 50, stroke: 5 },
    crowd: { baseY: 1330, pio: 330, fig: 120 },
    flowers: [
      { f: "margaret-orange", w: 300, x: -110, y: -80, r: -8 },
      { f: "margaret-white", w: 230, x: 900, y: 90, r: 14 },
      { f: "margaret-white", w: 340, x: -170, y: 560, r: -14 },
      { f: "margaret-orange", w: 300, x: 880, y: 720, r: 20 },
      { f: "margaret-white", w: 250, x: -90, y: 1120, r: -18 },
      { f: "margaret-orange", w: 210, x: 930, y: 1180, r: 26 },
    ],
  },

  /* SNSでシェアされたときに出る画像（og:image）。
     1200x630 は各サービスが想定している 1.91:1。これを外すと上下か左右が切られる。
     タイムラインでは幅500px程度に縮んで表示されるので、文字は大きめにし、
     小さくて読めないものは載せない（住所は省いている）。
     透過は無し。透明部分は黒く塗られる環境があるため。 */
  "ogp-1200x630": {
    W: 1200, H: 630,
    tapes: [
      { len: 1800, h: 62, rot: -1.6, x: -300, y: 6, opacity: 0.5 },
      { len: 1800, h: 56, rot: 1.1, x: -280, y: 566, opacity: 0.42 },
    ],
    // 文字は中央の白ざぶとんに乗せ、人だかりはその左右に逃がす
    panel: { x: 162, top: 152, w: 876, h: 344, radius: 34, alpha: 0.66 },
    logoW: 430, logoY: 88,
    badge: { y: 266, size: 22, spacing: 2 },
    date: { y: 350, size: 62, stroke: 6 },
    venue: { y: 402, size: 27, stroke: 3 },
    catch: { y1: 452, y2: null, size: 26, stroke: 3 }, // 横長なので1行だけ
    crowdMode: "sides",
    crowd: { baseY: 614, pio: 176, fig: 72, edge: 26 },
    flowers: [
      { f: "margaret-orange", w: 190, x: -70, y: -56, r: -8 },
      { f: "margaret-white", w: 150, x: 1090, y: 40, r: 14 },
      { f: "margaret-white", w: 210, x: -96, y: 300, r: -14 },
      { f: "margaret-orange", w: 175, x: 1075, y: 330, r: 20 },
    ],
  },
};

// ---------------------------------------------------------------- 組み立て
async function build(name, L, { withText }) {
  const cx = L.W / 2;

  // 地：グラデを全面に。SNS画像はそれ自体がメインビジュアルなので面で切らない
  const bg = `<svg width="${L.W}" height="${L.H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0.22">
      <stop offset="0%" stop-color="${C.gradL}"/><stop offset="26%" stop-color="${C.gradG}"/>
      <stop offset="52%" stop-color="${C.gradC}"/><stop offset="100%" stop-color="${C.gradR}"/>
    </linearGradient></defs>
    <rect width="${L.W}" height="${L.H}" fill="url(#g)"/>
    ${petals(L.W, L.H)}
  </svg>`;

  const back = [];
  for (const t of L.tapes) {
    const buf = await tapeStrip(t);
    const p = await placeAt(buf, t.x, t.y, L.W, L.H);
    if (p) back.push(p);
  }
  for (const fl of L.flowers) {
    const buf = await sharp(`${IMG}/art/${fl.f}.png`).resize({ width: fl.w })
      .rotate(fl.r, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
    const p = await placeAt(buf, Math.round(fl.x), Math.round(fl.y), L.W, L.H);
    if (p) back.push(p);
  }

  // 透かしの白ざぶとん。マステや花より前、ロゴ・人・文字より後ろに挟む
  const p = L.panel;
  back.push({
    input: Buffer.from(
      `<svg width="${p.w}" height="${p.h}" xmlns="http://www.w3.org/2000/svg">
         <rect width="${p.w}" height="${p.h}" rx="${p.radius}" fill="#fff" fill-opacity="${p.alpha}"/>
       </svg>`
    ),
    left: p.x,
    top: p.top,
  });

  let img = await sharp(Buffer.from(bg)).composite(back).png().toBuffer();

  // 人だかり。縦長は下辺いっぱいに広げて「人が戻ってくる」絵にする。
  // 横長は縦に余裕が無く文字と重なるので、中央は空けて左右の端に寄せる。
  const roster =
    L.crowdMode === "sides"
      ? [
          { f: "art/mamatoko", s: 1 }, { f: "art/chibicos", s: 0.81 },
          { f: "piosun", s: null },
          { f: "art/hiyorinmioshin", s: 1 }, { f: "art/pregnant-pair", s: 1 },
        ]
      : [
          { f: "art/friends", s: 1 }, { f: "art/mamatoko", s: 1 }, { f: "art/chibicos", s: 0.81 },
          { f: "art/shopping", s: 1 }, { f: "piosun", s: null }, { f: "art/hiyorinmioshin", s: 1 },
          { f: "art/pregnant-pair", s: 1 }, { f: "art/helpmark", s: 1 }, { f: "art/n-doc", s: 1 },
        ];
  const figs = [];
  for (const r of roster) {
    const h = r.s === null ? L.crowd.pio : Math.round(L.crowd.fig * r.s);
    const b = await sharp(`${IMG}/${r.f}.png`).resize({ height: h }).toBuffer();
    figs.push({ b, w: (await sharp(b).metadata()).width, h, pio: r.s === null });
  }
  const front = [];

  if (L.crowdMode === "sides") {
    const gap = Math.round(L.crowd.fig * 0.28);
    const pio = figs.find((f) => f.pio);
    const others = figs.filter((f) => !f.pio);
    // 右端にぴおすん、その手前に1人
    let rx = L.W - pio.w - L.crowd.edge;
    front.push(await placeAt(pio.b, rx, L.crowd.baseY - pio.h, L.W, L.H));
    for (const f of others.slice(2)) {
      rx -= f.w + gap;
      front.push(await placeAt(f.b, rx, L.crowd.baseY - f.h, L.W, L.H));
    }
    // 左端に残り
    let lx = L.crowd.edge;
    for (const f of others.slice(0, 2)) {
      front.push(await placeAt(f.b, lx, L.crowd.baseY - f.h, L.W, L.H));
      lx += f.w + gap;
    }
  } else {
    const totalW = figs.reduce((s, f) => s + f.w, 0);
    const gap = Math.round((L.W - totalW) / (figs.length + 1));
    let x = gap;
    for (const f of figs) {
      const p = await placeAt(f.b, x, L.crowd.baseY - f.h, L.W, L.H);
      if (p) front.push(p);
      x += f.w + gap;
    }
  }

  // ロゴ
  const logo = await sharp(`${IMG}/logo-2027.png`).resize({ width: L.logoW }).toBuffer();
  front.push(await placeAt(logo, Math.round(cx - L.logoW / 2), L.logoY, L.W, L.H));

  if (withText) {
    const b = L.badge, half = b.size * 5.6, g2 = b.size * 0.9, rule = b.size * 1.6;
    const svg = `<svg width="${L.W}" height="${L.H}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${cx - half - g2 - rule}" y="${b.y - b.size * 0.42}" width="${rule}" height="${Math.max(3, b.size * 0.13)}" rx="2" fill="${C.accent}"/>
      <rect x="${cx + half + g2}" y="${b.y - b.size * 0.42}" width="${rule}" height="${Math.max(3, b.size * 0.13)}" rx="2" fill="${C.accent}"/>
      ${text({ x: cx, y: b.y, size: b.size, fill: C.ink, family: ROUND, weight: 800, spacing: b.spacing, content: CONTENT.badge })}
      ${text({ x: cx, y: L.date.y, size: L.date.size, fill: C.accent, family: ROUND, weight: 800, stroke: L.date.stroke, content: CONTENT.date })}
      ${text({ x: cx, y: L.venue.y, size: L.venue.size, fill: C.ink, stroke: L.venue.stroke, content: CONTENT.venue })}
      ${text({ x: cx, y: L.catch.y1, size: L.catch.size, fill: L.catch.y2 ? C.ink : C.accent, family: ROUND, weight: 800, stroke: L.catch.stroke, content: L.catch.y2 ? CONTENT.catch1 : CONTENT.catch2 })}
      ${L.catch.y2 ? text({ x: cx, y: L.catch.y2, size: L.catch.size, fill: C.accent, family: ROUND, weight: 800, stroke: L.catch.stroke, content: CONTENT.catch2 }) : ""}
    </svg>`;
    front.push({ input: Buffer.from(svg), top: 0, left: 0 });
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const out = `${OUT_DIR}/${name}${withText ? "" : "-plain"}.png`;
  await sharp(img).composite(front.filter(Boolean)).png({ compressionLevel: 9 }).toFile(out);
  console.log(`${out}  ${L.W}x${L.H}  ${Math.round(statSync(out).size / 1024)}KB`);
}

ensureFont();
for (const [name, L] of Object.entries(LAYOUTS)) {
  await build(name, L, { withText: true });
  await build(name, L, { withText: false }); // 文字なしの台紙
}
