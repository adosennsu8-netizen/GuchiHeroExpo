// src/screens/CountdownScreen.js
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, SafeAreaView } from 'react-native';
import { leaveQueue } from '../services/firebase';

export default function CountdownScreen({ route, navigation }) {
  const { heroName, voiceType, uid } = route.params;
  const [phase, setPhase] = useState('countdown'); // 'countdown' | 'hiro' | 'live' | 'end'
  const [countNum, setCountNum] = useState(3);
  const [remaining, setRemaining] = useState(59);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const pulse = (callback) => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.4, duration: 120, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,   duration: 380, useNativeDriver: true }),
    ]).start(callback);
  };

  // カウントダウン 3→2→1→披露→live
  useEffect(() => {
    let count = 3;
    pulse(() => {});

    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        setCountNum(count);
        pulse(() => {});
      } else {
        clearInterval(timer);
        setPhase('hiro');
        setTimeout(() => setPhase('live'), 1000);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 発表タイマー 59→0
  useEffect(() => {
    if (phase !== 'live') return;

    const timer = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setPhase('end');
          handleEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase]);

  const handleEnd = async () => {
    await leaveQueue(uid);
    setTimeout(() => navigation.replace('Main'), 2000);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ステージ */}
      <View style={styles.stage}>
        <View style={styles.curtainLeft} />
        <View style={styles.curtainRight} />
        <View style={styles.spotlight} />

        <View style={styles.stageCenter}>
          {phase === 'countdown' && (
            <Animated.Text style={[styles.countNum, { transform: [{ scale: scaleAnim }] }]}>
              {countNum}
            </Animated.Text>
          )}
          {phase === 'hiro' && (
            <Text style={styles.hiroText}>披露</Text>
          )}
          {phase === 'live' && (
            <Text style={[styles.liveTimer, remaining <= 10 && styles.liveTimerRed]}>
              {remaining}
            </Text>
          )}
          {phase === 'end' && (
            <Text style={styles.endText}>終了</Text>
          )}
        </View>

        <View style={styles.micWrap}>
          <View style={styles.micHead} />
          <View style={styles.micNeck} />
        </View>
        <View style={styles.floor}>
          <View style={styles.micBase} />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.privacyBox}>
          <Text style={styles.privacyMain}>声は自動的に変換されます</Text>
          <Text style={styles.privacySub}>プライバシー保護モード ON</Text>
        </View>

        <View style={styles.nameBox}>
          <Text style={styles.nameLabel}>あなたは</Text>
          <Text style={styles.nameValue}>{heroName}</Text>
          <Text style={styles.nameSub}>として登場しています</Text>
        </View>

        {phase === 'live' && (
          <Text style={styles.hint}>マイクに向かって愚痴を発表してください</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#0f0f0f' },
  stage:         { height: 280, backgroundColor: '#1a1020', alignItems: 'center', justifyContent: 'flex-end', position: 'relative', overflow: 'hidden' },
  curtainLeft:   { position: 'absolute', left: 0, top: 0, width: '35%', height: '100%', backgroundColor: '#6b1a2a', borderBottomRightRadius: 40 },
  curtainRight:  { position: 'absolute', right: 0, top: 0, width: '35%', height: '100%', backgroundColor: '#6b1a2a', borderBottomLeftRadius: 40 },
  spotlight:     { position: 'absolute', top: 0, width: 140, height: 220, borderRadius: 70, opacity: 0.07, backgroundColor: '#ffd864' },
  stageCenter:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 70, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  countNum:      { fontSize: 96, fontWeight: '700', color: '#fff' },
  hiroText:      { fontSize: 56, fontWeight: '700', color: '#fac775' },
  liveTimer:     { fontSize: 80, fontWeight: '700', color: '#fff' },
  liveTimerRed:  { color: '#e24b4a' },
  endText:       { fontSize: 48, fontWeight: '700', color: '#64FF96' },
  micWrap:       { position: 'absolute', bottom: 70, alignItems: 'center', zIndex: 3 },
  micHead:       { width: 22, height: 28, backgroundColor: '#888', borderRadius: 11, borderWidth: 2, borderColor: '#aaa' },
  micNeck:       { width: 3, height: 36, backgroundColor: '#666' },
  floor:         { width: '100%', height: 70, backgroundColor: '#2a1a10', borderTopWidth: 3, borderTopColor: '#8b6a30', zIndex: 1, alignItems: 'center', justifyContent: 'center' },
  micBase:       { width: 40, height: 4, backgroundColor: '#555', borderRadius: 2 },
  content:       { padding: 16, gap: 12 },
  privacyBox:    { backgroundColor: 'rgba(162,45,45,0.2)', borderWidth: 0.5, borderColor: '#A32D2D', borderRadius: 8, padding: 12, alignItems: 'center' },
  privacyMain:   { fontSize: 13, fontWeight: '500', color: '#F09595' },
  privacySub:    { fontSize: 11, color: '#888', marginTop: 4 },
  nameBox:       { backgroundColor: '#1a1a1a', borderWidth: 0.5, borderColor: '#333', borderRadius: 8, padding: 12 },
  nameLabel:     { fontSize: 11, color: '#888' },
  nameValue:     { fontSize: 14, fontWeight: '500', color: '#fff', marginTop: 4 },
  nameSub:       { fontSize: 11, color: '#888', marginTop: 2 },
  hint:          { fontSize: 12, color: '#888', textAlign: 'center' },
});
