// src/components/NiceButton.js
import React, { useRef } from 'react';
import { TouchableOpacity, Text, Animated, StyleSheet, View } from 'react-native';

export default function NiceButton({ onPress, pressed, totalNice }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (pressed) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,   duration: 150, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={handlePress} activeOpacity={pressed ? 1 : 0.7} style={[styles.btn, pressed && styles.btnPressed]}>
        <Animated.Text style={[styles.heart, pressed && styles.heartPressed, { transform: [{ scale }] }]}>
          ♥
        </Animated.Text>
        <Text style={[styles.label, pressed && styles.labelPressed]}>
          {pressed ? 'ナイス済み' : 'ナイス！'}
        </Text>
      </TouchableOpacity>
      <Text style={styles.total}>{totalNice} ナイス</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#222', gap: 10 },
  btn:          { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1e1e1e', borderWidth: 0.5, borderColor: '#333', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  btnPressed:   { borderColor: '#e24b4a', backgroundColor: 'rgba(226,75,74,0.1)' },
  heart:        { fontSize: 15, color: '#555' },
  heartPressed: { color: '#e24b4a' },
  label:        { fontSize: 12, color: '#888' },
  labelPressed: { color: '#e24b4a' },
  total:        { fontSize: 11, color: '#555', marginLeft: 'auto' },
});
