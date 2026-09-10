/**
 * 自分で組むための部品を書き出す。
 *
 *   npm install sharp     （初回のみ）
 *   node tools/build-parts.mjs
 *
 * 出力（parts/）
 *   bg-1080x1350.png … 花びら付きのグラデ背景（Instagramフィード用）
 *   bg-1200x675.png  … 同（X用）
 *   bg-1080x1920.png … 同（Instagramストーリーズ用）
 *   tape-3125x140.png … マステ1本。透過なし（白は不透明）
 *
 * マステは strip.png を5回繰り返した長さで、両端が半分の間隔になっているため
 * 横に並べれば継ぎ目なく伸ばせる。斜めにしても端が見切れるだけの長さがある。
 */
import sharp from "sharp";
import { mkdirSync, statSync } from "node:fs";

const C = {
  gradL: "#9de5e0",
  gradG: "#cff2c9", // くすみ止めの緑。これが無いと青緑→黄色の途中がくすむ
  gradC: "#fbf4d0",
  gradR: "#ffbdb5",
};
const IMG = "img2027";
const OUT = "parts";

/** 舞う花びら（しずく形）。画面の比率に合わせて散らす */
function petals(W, H) {
  const seed = [
    [5, 10, 26, -18, 0.85], [17, 30, 15, 28, 0.6], [10, 58, 34, -6, 0.8], [23, 74, 14, 52, 0.55],
    [31, 16, 18, 12, 0.7], [39, 48, 14, -34, 0.6], [45, 82, 44, 20, 0.85], [54, 24, 15, 44, 0.55],
    [61, 62, 21, -12, 0.75], [69, 12, 14, 24, 0.65], [76, 40, 38, -22, 0.82], [82, 68, 14, 38, 0.58],
    [88, 27, 21, 8, 0.7], [93, 54, 14, -42, 0.55], [14, 86, 18, 16, 0.65], [35, 5, 14, -30, 0.6],
    [66, 90, 30, 32, 0.78], [86, 7, 18, -10, 0.68], [50, 8, 14, 46, 0.55], [27, 46, 14, -38, 0.55],
    [72, 76, 17, 22, 0.62], [42, 66, 22, -26, 0.68], [95, 84, 15, 12, 0.58], [8, 40, 16, 34, 0.6],
  ];
  // 短辺を基準に大きさを決める。縦長でも横長でも花びらの見た目が変わらないように
  const unit = Math.min(W, H) / 1080;
  return seed
    .map(([lx, ty, pw0, rot, op]) => {
      const x = (lx / 100) * W, y = (ty / 100) * H;
      const pw = pw0 * unit, ph = pw * 0.58;
      return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot})">
        <path d="M0 ${ph} L0 ${ph / 2} A ${pw / 2} ${ph / 2} 0 0 1 ${pw} ${ph / 2}
                 A ${pw / 2} ${ph / 2} 0 0 1 ${pw / 2} ${ph} Z" fill="#fff" opacity="${op}"/></g>`;
    })
    .join("");
}

async function background(W, H) {
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0.22">
      <stop offset="0%" stop-color="${C.gradL}"/>
      <stop offset="26%" stop-color="${C.gradG}"/>
      <stop offset="52%" stop-color="${C.gradC}"/>
      <stop offset="100%" stop-color="${C.gradR}"/>
    </linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    ${petals(W, H)}
  </svg>`;
  const out = `${OUT}/bg-${W}x${H}.png`;
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out);
  return out;
}

async function tape({ height = 140, repeat = 5 } = {}) {
  const meta = await sharp(`${IMG}/icon/strip.png`).metadata();
  const inner = Math.round(height * 0.58); // テープの中での柄の高さ＝上下の余白
  const tileW = Math.round((meta.width * inner) / meta.height);
  const one = await sharp(`${IMG}/icon/strip.png`).resize({ height: inner }).toBuffer();
  const W = tileW * repeat;
  const tiles = [];
  for (let i = 0; i < repeat; i++) tiles.push({ input: one, left: i * tileW, top: Math.round((height - inner) / 2) });
  const out = `${OUT}/tape-${W}x${height}.png`;
  // 透過なし＝白は不透明。半透明にしたいときは配置先のソフトで下げる
  await sharp({ create: { width: W, height, channels: 4, background: "#ffffff" } })
    .composite(tiles)
    .png({ compressionLevel: 9 })
    .toFile(out);
  return out;
}

mkdirSync(OUT, { recursive: true });
const made = [
  await background(1080, 1350), // Instagram フィード
  await background(1200, 675),  // X
  await background(1080, 1920), // Instagram ストーリーズ
  await tape(),
];
for (const f of made) console.log(`${f}  ${Math.round(statSync(f).size / 1024)}KB`);
