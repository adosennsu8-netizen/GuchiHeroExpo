// functions/ngWordFilter.js
// src/services/ngWordFilter.js とロジックを同一に保つこと。
// クライアント側とサーバー側で判定基準がズレると、
// 「クライアントでは弾かれたのにサーバーでは違う」といった不整合が起きるため。
const NG_WORDS_HIRA = [
  '死ね', '殺す', '殺し', '自殺しろ',
  'きちがい', '気違い',
];

const NG_WORDS_PLAIN = [
  '大麻', '覚醒剤', '闇バイト', '振り込め詐欺',
];

const NG_PATTERNS_COMPLEX = [
  /住所.{0,10}(教えて|晒|さらせ)/,
  /電話番号.{0,10}(教えて|晒|さらせ)/,
  /本名.{0,10}(教えて|晒|さらせ)/,
];

function normalize(text) {
  return text
    .normalize('NFKC')
    .replace(/[ぁ-ん]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/[\s　・.,!！?？~〜\-ー]/g, '');
}

function toKana(word) {
  return word.replace(/[ぁ-ん]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

function containsNgWord(text) {
  if (!text) return false;
  const normalized = normalize(text);

  const hiraHit = NG_WORDS_HIRA.some((w) => normalized.includes(toKana(w)));
  if (hiraHit) return true;

  const plainHit = NG_WORDS_PLAIN.some((w) => normalized.includes(normalize(w)));
  if (plainHit) return true;

  const complexHit = NG_PATTERNS_COMPLEX.some((pattern) => pattern.test(text) || pattern.test(normalized));
  if (complexHit) return true;

  return false;
}

module.exports = { containsNgWord };