// src/components/NicePanel.js
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

const TOTAL_BLOCKS = 20;
const POINTS_PER_BLOCK = 5;
const HERO_THRESHOLD = 50;

export default function NicePanel({ points = 0 }) {
  const heroAnim = useRef(new Animated.Value(0)).current;
  const prevPoints = useRef(0);

  useEffect(() => {
    if (prevPoints.current < HERO_THRESHOLD && points >= HERO_THRESHOLD) {
      Animated.sequence([
        Animated.timing(heroAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(heroAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
    prevPoints.current = points;
  }, [points]);

  const filledBlocks = Math.min(Math.floor(points / POINTS_PER_BLOCK), TOTAL_BLOCKS);

  return (
    <View style={styles.container}>
      {/* ヒーロー認定バナー */}
      <Animated.View style={[styles.heroBanner, { opacity: heroAnim, transform: [{ scale: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}>
        <Text style={styles.heroEmoji}>🏆</Text>
        <Text style={styles.heroText}>愚痴ヒーロー認定！</Text>
      </Animated.View>

      {/* ポイント数 */}
      <Text style={styles.score}>{points}pt</Text>

      {/* 縦パネル（下から積み上がる） */}
      <View style={styles.panel}>
        {Array.from({ length: TOTAL_BLOCKS }).map((_, i) => {
          const blockIndex = TOTAL_BLOCKS - 1 - i;
          const isFilled = blockIndex < filledBlocks;
          const isRed = isFilled && blockIndex >= HERO_THRESHOLD / POINTS_PER_BLOCK;
          return (
            <View
              key={i}
              style={[
                styles.block,
                isFilled ? (isRed ? styles.blockRed : styles.blockYellow) : styles.blockEmpty,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { position: 'absolute', right: 8, top: 8, bottom: 70, width: 20, alignItems: 'center', zIndex: 4 },
  panel:      { flex: 1, width: '100%', gap: 1, flexDirection: 'column' },
  block:      { flex: 1, borderRadius: 2 },
  blockEmpty: { backgroundColor: '#2a2a2a' },
  blockYellow:{ backgroundColor: '#E6A817' },
  blockRed:   { backgroundColor: '#e24b4a' },
  score:      { fontSize: 8, color: '#888', marginBottom: 3 },
  heroBanner: { position: 'absolute', top: -60, left: -80, width: 110, backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 8, padding: 8, alignItems: 'center', zIndex: 10, borderWidth: 0.5, borderColor: '#fac775' },
  heroEmoji:  { fontSize: 18 },
  heroText:   { fontSize: 9, fontWeight: '500', color: '#fac775', marginTop: 2, textAlign: 'center' },
});
