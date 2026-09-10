/**
 * 日付・キャッチ・バッジに使う丸ゴシック（Rounded M+ 2p black）を、
 * 必要な文字だけに絞ってWebフォント(WOFF2)に書き出す。
 *
 *   npm install subset-font     （初回のみ）
 *   node tools/build-font.mjs
 *   → img2027/font/rounded-mplus-2p-black-subset.woff2
 *
 * 【なぜ絞るのか】
 * 日本語フォントは全文字入りで3.5MB。ティザー1枚にそれは重すぎる。
 * 使う文字だけなら数十KBで済む。
 *
 * 【何を入れているか】
 * index.html の .date / .badge / .catch から実際の文字を読み取り、
 * そこに保険として英数記号・ひらがな・カタカナ・よく使う記号と漢字を足している。
 * 文言を変えたらこれを実行し直せば、新しい文字が入る。
 *
 * 【入っていない文字が出たらどうなるか】
 * CSSの font-family で次に指定した "M PLUS Rounded 1c"（Google Fonts）に落ちる。
 * ほぼ同じ系統の丸ゴシックなので、見た目が大きく崩れることはない。
 * ただし漢字を新しく使ったときは、ここを実行し直すのが正しい。
 *
 * 【ライセンス】
 * 自家製 Rounded M+ は M+ FONTS のライセンスに準拠し、用途を問わず無償で自由に
 * 使える（再配布・サーバーへの設置を含む）。
 */
import subsetFont from "subset-font";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";

const SRC = "tools/.fonts/src/rounded-mplus-2p-black.ttf";
const OUT_DIR = "img2027/font";
const OUT = `${OUT_DIR}/rounded-mplus-2p-black-subset.woff2`;

if (!existsSync(SRC)) {
  console.error(`元のフォントが無い: ${SRC}`);
  console.error("配布元(http://jikasei.me/font/rounded-mplus/)の書庫を tools/.fonts/src に展開しておくこと");
  process.exit(1);
}

// --- サイトで丸ゴシックを使っている箇所から文字を集める
const html = readFileSync("index.html", "utf8");
const pick = (cls) =>
  [...html.matchAll(new RegExp(`class="${cls}"[^>]*>([\\s\\S]*?)</p>`, "g"))]
    .map((m) => m[1].replace(/<[^>]*>/g, ""))
    .join("");
const fromHtml = ["date", "badge", "catch"].map(pick).join("");

// --- 保険。ここが入っていれば、文言を多少変えても作り直さずに済む
const range = (start, len) => Array.from({ length: len }, (_, i) => String.fromCharCode(start + i)).join("");
const safety =
  range(0x20, 95) + // 英数記号
  range(0x3041, 86) + // ひらがな
  range(0x30a1, 90) + // カタカナ
  "　、。・「」『』（）〜ー！？：／％＋−×" +
  "年月日時分秒曜土日月火水木金第回開催決定会場入場無料前売当日出展募集受付開始";

const chars = [...new Set(fromHtml + safety)].filter((c) => c.trim() !== "" || c === " ").join("");

const src = readFileSync(SRC);
const out = await subsetFont(src, chars, { targetFormat: "woff2" });

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, out);

console.log(`${OUT}`);
console.log(`  ${chars.length}文字  ${Math.round(statSync(OUT).size / 1024)}KB  （元は ${Math.round(src.length / 1024 / 1024 * 10) / 10}MB）`);
console.log(`  HTMLから拾った文字: ${[...new Set(fromHtml)].length}種`);
