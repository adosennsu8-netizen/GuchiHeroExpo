// src/services/ghostAudience.js
// 視聴者ゼロ対策：ランダムなゴーストオーディエンスとオートコメント

const GHOST_COMMENTS = [
  'わかるわー', 'それは辛い', 'がんばれ', '共感します', '拍手',
  'すごい', 'かなしい', 'あるある', 'お疲れ様', 'うんうん',
];

// ランダム視聴者数（4〜8人）
export const getGhostViewerCount = () => {
  return Math.floor(4 + Math.random() * 5);
};

// ゴーストコメントを一定間隔で流す
export const startGhostComments = (onComment) => {
  const intervals = [];

  const scheduleNext = () => {
    // 8〜20秒のランダム間隔
    const delay = 8000 + Math.random() * 12000;
    const timer = setTimeout(() => {
      const text = GHOST_COMMENTS[Math.floor(Math.random() * GHOST_COMMENTS.length)];
      onComment({ text, createdAt: Date.now(), isGhost: true });
      scheduleNext();
    }, delay);
    intervals.push(timer);
  };

  scheduleNext();

  return () => intervals.forEach(clearTimeout);
};
