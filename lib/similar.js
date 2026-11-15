// 似た名前の判定: 全角半角・大文字小文字・ひらがな/カタカナ・記号の差、似た文字(0/o, 1/l/i など)・文字の繰り返しを吸収して類似度(0〜1)を出す
export const norm = (s) => String(s || "").normalize("NFKC").toLowerCase().replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60)).replace(/[\s_\-.・·'"`~]/g, "");
const MAP = { "0": "o", "1": "l", "!": "l", "|": "l", i: "l", "5": "s", $: "s", "3": "e", "4": "a", "@": "a", "7": "t", "8": "b", "9": "g", "ー": "" };
export const skeleton = (s) => norm(s).replace(/[0-9!|$@]|i|ー/g, (c) => (c in MAP ? MAP[c] : c)).replace(/(.)\1+/g, "$1");

function lev(a, b) {
  if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
const bigrams = (s) => { const g = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); g.set(k, (g.get(k) || 0) + 1); } return g; };
function dice(a, b) {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const A = bigrams(a), B = bigrams(b); let inter = 0;
  for (const [k, n] of A) inter += Math.min(n, B.get(k) || 0);
  return (2 * inter) / (a.length - 1 + b.length - 1);
}
export function similarity(a, b) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return 0; if (na === nb) return 1;
  const sa = skeleton(a), sb = skeleton(b);
  const ratio = (x, y) => { const m = Math.max(x.length, y.length); return m ? 1 - lev(x, y) / m : 0; };
  let sc = Math.max(ratio(na, nb), ratio(sa, sb) * 0.97, dice(na, nb) * 0.95);
  if (na.includes(nb) || nb.includes(na)) sc = Math.max(sc, 0.65 + 0.3 * (Math.min(na.length, nb.length) / Math.max(na.length, nb.length)));
  return Math.min(0.999, sc);
}
