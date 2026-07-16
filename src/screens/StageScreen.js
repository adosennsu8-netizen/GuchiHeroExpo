// src/screens/StageScreen.js
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FloatingComments from '../components/FloatingComments';
import NiceButton from '../components/NiceButton';
import NicePanel from '../components/NicePanel';
import QuickComments from '../components/QuickComments';
import { generateHeroName, sendComment, sendNice, subscribeComments, subscribeStage } from '../services/firebase';
import { getGhostViewerCount, startGhostComments } from '../services/ghostAudience';

export default function StageScreen({ navigation }) {
  const [stageStatus, setStageStatus] = useState('idle');
  const [comments, setComments] = useState([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [niceCount, setNiceCount] = useState(0);
  const [nicedThisSession, setNicedThisSession] = useState(false);
  const [heroName] = useState(generateHeroName);
  const [countNum, setCountNum] = useState(3);
  const [showHiro, setShowHiro] = useState(false);
  const [remaining, setRemaining] = useState(59);

  const countScale = useRef(new Animated.Value(1)).current;
  const ghostStopRef = useRef(null);
  const prevSpeakerRef = useRef(null);

  useEffect(() => {
    const unsubStage = subscribeStage((data) => {
      if (!data) return;
      setStageStatus(data.status || 'idle');
      setQueueCount(data.queue ? Object.keys(data.queue).length : 0);
      const newSpeakerId = data.currentSpeaker?.id;
      if (newSpeakerId !== prevSpeakerRef.current) {
        setNicedThisSession(false);
        setNiceCount(0);
        prevSpeakerRef.current = newSpeakerId;
      }
      setCurrentSpeaker(data.currentSpeaker || null);
      setNiceCount(data.niceCount || 0);
      const realCount = data.viewerCount || 0;
      setViewerCount(realCount > 0 ? realCount : getGhostViewerCount());
    });
    const unsubComments = subscribeComments(setComments);
    return () => { unsubStage(); unsubComments(); };
  }, []);

  useEffect(() => {
    if (stageStatus === 'live') {
      ghostStopRef.current = startGhostComments((c) => {
        setComments(prev => [...prev.slice(-49), c]);
      });
    }
    return () => ghostStopRef.current?.();
  }, [stageStatus]);

  useEffect(() => {
    if (stageStatus !== 'countdown') return;
    setCountNum(3); setShowHiro(false); setRemaining(59);
    let count = 3;
    const pulse = () => {
      Animated.sequence([
        Animated.timing(countScale, { toValue: 1.4, duration: 120, useNativeDriver: true }),
        Animated.timing(countScale, { toValue: 1, duration: 380, useNativeDriver: true }),
      ]).start();
    };
    pulse();
    const timer = setInterval(() => {
      count--;
      if (count > 0) { setCountNum(count); pulse(); }
      else {
        clearInterval(timer);
        setShowHiro(true);
        setTimeout(() => { setShowHiro(false); setStageStatus('live'); }, 1000);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [stageStatus]);

  useEffect(() => {
    if (stageStatus !== 'live') return;
    setRemaining(59);
    const timer = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setStageStatus('end');
          setTimeout(() => setStageStatus('idle'), 2000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [stageStatus]);

  const handleNice = async () => {
    if (nicedThisSession) return;
    setNicedThisSession(true);
    setNiceCount(prev => prev + 1);
    await sendNice(currentSpeaker?.id);
  };

  const handleSendComment = async (text) => {
    await sendComment(text);
  };

  const isLive = stageStatus === 'live';
  const isCountdown = stageStatus === 'countdown';
  const isEnd = stageStatus === 'end';

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, Platform.OS === 'web' && styles.headerWebSafeArea]}>
        <View>
          <Text style={styles.title}>愚痴HERO</Text>
          <Text style={styles.subtitle}>愚痴披露ステージ</Text>
        </View>
        {queueCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>待ち {queueCount}人</Text>
          </View>
        )}
      </View>

      <ImageBackground source={require('../../assets/stage.png')} style={styles.stage} resizeMode="contain">
        {/* 発表中/カウントダウンに関わらず常時表示。コメント購読自体は元々常時動いている */}
        <FloatingComments comments={comments} />
        {isLive && <NicePanel points={niceCount} />}
        <View style={styles.stageCenter}>
          {isCountdown && !showHiro && (
            <Animated.Text style={[styles.countNum, { transform: [{ scale: countScale }] }]}>
              {countNum}
            </Animated.Text>
          )}
          {isCountdown && showHiro && <Text style={styles.hiroText}>披露</Text>}
          {isLive && (
            <Text style={[styles.liveTimer, remaining <= 10 && styles.liveTimerRed]}>
              {remaining}
            </Text>
          )}
          {isEnd && <Text style={styles.endText}>終了</Text>}
        </View>
      </ImageBackground>

      <View style={styles.audienceBar}>
        <Text style={styles.audienceLabel}>視聴中</Text>
        <Text style={styles.audienceCount}>{viewerCount}人</Text>
        {currentSpeaker && (
          <Text style={styles.speakerName}>{currentSpeaker.heroName} が発表中</Text>
        )}
      </View>

      {isLive && (
        <NiceButton
          onPress={handleNice}
          pressed={nicedThisSession}
          totalNice={niceCount}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.actionArea}>
          {queueCount > 0 && (
            <View style={styles.queueBox}>
              <View style={styles.queueDot} />
              <Text style={styles.queueText}>発表待ち</Text>
              <Text style={styles.queueNum}>{queueCount}人</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.btnMain}
            onPress={() => navigation.navigate('VoiceSelect', { heroName })}
            activeOpacity={0.8}
          >
            <Text style={styles.btnMainText}>🎤 次の発表者に立候補</Text>
          </TouchableOpacity>
          <QuickComments onSend={handleSendComment} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#0f0f0f' },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#1a1a1a', borderBottomWidth: 0.5, borderBottomColor: '#333' },
  // Web版：スマホのステータスバー（時刻・電波等）とヘッダーが重ならないよう安全領域分を追加
  headerWebSafeArea: { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' },
  title:         { fontSize: 16, fontWeight: '500', color: '#fff' },
  subtitle:      { fontSize: 11, color: '#888', marginTop: 2 },
  badge:         { backgroundColor: 'rgba(186,117,23,0.2)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:     { fontSize: 11, color: '#fac775' },
  stage:         { width: '100%', maxWidth: 900, alignSelf: 'center', aspectRatio: 1536 / 1024, position: 'relative', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a' },
  stageCenter:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  countNum:      { fontSize: 88, fontWeight: '700', color: '#fff' },
  hiroText:      { fontSize: 52, fontWeight: '700', color: '#fac775' },
  liveTimer:     { fontSize: 72, fontWeight: '700', color: '#fff', opacity: 0.9 },
  liveTimerRed:  { color: '#e24b4a' },
  endText:       { fontSize: 48, fontWeight: '700', color: '#64FF96' },
  audienceBar:   { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: '#222' },
  audienceLabel: { fontSize: 11, color: '#888' },
  audienceCount: { fontSize: 13, fontWeight: '500', color: '#fff' },
  speakerName:   { fontSize: 11, color: '#888', marginLeft: 'auto' },
  actionArea:    { padding: 14, gap: 10 },
  queueBox:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 8, padding: 10, gap: 8 },
  queueDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e24b4a' },
  queueText:     { fontSize: 12, color: '#aaa', flex: 1 },
  queueNum:      { fontSize: 12, fontWeight: '500', color: '#fff' },
  btnMain:       { backgroundColor: '#6b1a2a', borderRadius: 8, padding: 14, alignItems: 'center' },
  btnMainText:   { fontSize: 15, fontWeight: '500', color: '#fff' },
});
