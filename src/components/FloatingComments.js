// src/components/FloatingComments.js
import { useEffect, useRef } from 'react';
import { View, Animated, Text, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const LANES = 10;
const LANE_H = 36;

function FloatingComment({ text, lane }) {
  const x = useRef(new Animated.Value(width)).current;

  // コメント長さで速度を変える（短い=速い、長い=ゆっくり）
  const charCount = text.length;
  const duration = Math.max(4000, Math.min(8000, 3000 + charCount * 150));

  useEffect(() => {
    Animated.timing(x, {
      toValue: -(width + 300),
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
  return (
    <View style={styles.container} pointerEvents="none">
      {comments.slice(-20).map((c, i) => (
        <FloatingComment key={`${c.createdAt}-${i}`} text={c.text} lane={i % LANES} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 3 },
  comment:   { position: 'absolute' },
  text:      { fontSize: 13, fontWeight: '600', color: '#fff',
               textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
});
