// src/components/FloatingComments.js
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

const LANES = 6;
const LANE_H = 34;

function FloatingComment({ text, lane, containerWidth }) {
  // コンテナの実測幅を基準に、右端の外側からスタートして左端の外側まで流れる
  const x = useRef(new Animated.Value(containerWidth)).current;

  // コメント長さで速度を変える（短い=速い、長い=ゆっくり）
  // 以前は最短4秒で画面を通過しており速すぎて読めなかったため、下限・上限とも引き上げ
  const charCount = text.length;
  const duration = Math.max(7000, Math.min(14000, 5000 + charCount * 250));

  useEffect(() => {
    Animated.timing(x, {
      toValue: -(containerWidth + 300),
      duration,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.comment, { top: lane * LANE_H + 6, transform: [{ translateX: x }] }]}>
      <Text style={styles.text}>{text}</Text>
    </Animated.View>
  );
}

export default function FloatingComments({ comments }) {
  // Dimensions.get('window')だとWeb版でステージ枠の実サイズとズレるため、
  // 枠自体のonLayoutで実測して基準にする
  const [containerWidth, setContainerWidth] = useState(0);

  // 各レーンが「いつ空くか」を記録しておき、連打された時に埋まっているレーンへ
  // 重ねて表示してしまわないよう、その時点で一番早く空くレーンへ割り当てる
  const laneFreeAtRef = useRef(new Array(LANES).fill(0));
  const laneAssignmentRef = useRef(new Map()); // コメントのkey -> 割り当てたレーン番号

  const visibleComments = comments.slice(-20);

  visibleComments.forEach((c) => {
    const key = `${c.createdAt}`;
    if (laneAssignmentRef.current.has(key)) return;

    const now = Date.now();
    let bestLane = 0;
    let bestFreeAt = Infinity;
    for (let i = 0; i < LANES; i++) {
      if (laneFreeAtRef.current[i] < bestFreeAt) {
        bestFreeAt = laneFreeAtRef.current[i];
        bestLane = i;
      }
    }

    const charCount = c.text.length;
    const duration = Math.max(7000, Math.min(14000, 5000 + charCount * 250));
    laneAssignmentRef.current.set(key, bestLane);
    laneFreeAtRef.current[bestLane] = now + duration;
  });

  // 画面から消えたコメントの割り当て情報は掃除しておく（メモリが増え続けないように）
  useEffect(() => {
    const validKeys = new Set(visibleComments.map((c) => `${c.createdAt}`));
    for (const key of laneAssignmentRef.current.keys()) {
      if (!validKeys.has(key)) laneAssignmentRef.current.delete(key);
    }
  });

  return (
    <View
      style={styles.container}
      pointerEvents="none"
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {containerWidth > 0 &&
        visibleComments.map((c) => (
          <FloatingComment
            key={`${c.createdAt}`}
            text={c.text}
            lane={laneAssignmentRef.current.get(`${c.createdAt}`)}
            containerWidth={containerWidth}
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 3 },
  comment:   { position: 'absolute' },
  text:      { fontSize: 22, fontWeight: '700', color: '#fff',
               textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
});
