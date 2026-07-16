// src/components/FloatingComments.js
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

const LANES = 10;
const LANE_H = 48;

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

  return (
    <View
      style={styles.container}
      pointerEvents="none"
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {containerWidth > 0 &&
        comments.slice(-20).map((c, i) => (
          <FloatingComment
            key={`${c.createdAt}-${i}`}
            text={c.text}
            lane={i % LANES}
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
