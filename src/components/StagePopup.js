// src/components/StagePopup.js
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity } from 'react-native';

export default function StagePopup({ visible, onPress }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scale, { toValue: 0.8, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <TouchableOpacity style={styles.overlay} onPress={onPress} activeOpacity={1}>
      <Animated.View style={[styles.popup, { opacity, transform: [{ scale }] }]}>
        <Text style={styles.emoji}>🎭</Text>
        <Text style={styles.title}>ステージが始まるぞ！</Text>
        <Text style={styles.sub}>タップしてステージへ</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  popup:   { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: '#6b1a2a', width: 260 },
  emoji:   { fontSize: 48, marginBottom: 12 },
  title:   { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 6 },
  sub:     { fontSize: 13, color: '#888' },
});
