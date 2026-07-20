// src/screens/StageScreen.js
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
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
import { connectAsSpeaker, connectAsListener, disconnectAudio } from '../services/liveAudio';
import { getMyQueueId } from '../services/myQueueId';

const stageImageSource = require('../../assets/stage.png');
// Web版：ImageBackgroundのresizeMode="cover"がRN Web上では中央基準にならず
// 左上基準で切り取られてしまう挙動があったため、Web版だけは素のCSS背景画像として描画し、
// background-position:centerを直接効かせる。
// requireの戻り値がWeb環境では文字列そのもののことがあるため、型を確認しつつ安全に取得する
function resolveStageImageUriWeb() {
  if (Platform.OS !== 'web') return null;
  try {
    if (typeof stageImageSource === 'string') return stageImageSource;
    if (stageImageSource && typeof stageImageSource === 'object' && stageImageSource.uri) {
      return stageImageSource.uri;
    }
    const resolved = Image.resolveAssetSource(stageImageSource);
    return resolved?.uri || null;
  } catch (e) {
    console.warn('stage.png のURI解決に失敗しました', e);
    return null;
  }
}
const stageImageUriWeb = resolveStageImageUriWeb();

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
  // 現在接続中のLiveKitルーム（発表者としてマイク配信中、または視聴者として音声受信中）
  const audioRoomRef = useRef(null);
  // 接続処理が二重に走らないようにするためのロック
  const audioConnectingRef = useRef(false);

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
    if (stageStatus !== 'live' || !currentSpeaker?.startedAt) return;
    // countdownは4秒固定（Cloud Functions側の実装と合わせる）
    // サーバーに記録された本当の発表開始時刻から、毎秒「本当の経過時間」を計算し直す。
    // ローカルでただ数えるだけだと、通知の受信タイミングのズレや状態切り替えの
    // 重なりで表示がズレる（早く終わる／59に巻き戻る等）ため、常に真の時刻から逆算する。
    const liveStartedAt = currentSpeaker.startedAt + 4000;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - liveStartedAt) / 1000);
      const rem = Math.max(0, 59 - elapsed);
      setRemaining(rem);
      if (rem <= 0) {
        setStageStatus('end');
        setTimeout(() => setStageStatus('idle'), 2000);
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [stageStatus, currentSpeaker?.startedAt]);

  // 音声接続の管理。
  // countdown/liveの間だけLiveKitに接続し、それ以外（end/idle/confirming）では必ず切断する。
  // 自分がcurrentSpeakerと一致すれば発表者（マイク配信）、そうでなければ視聴者（音声受信のみ）として繋ぐ。
  useEffect(() => {
    const shouldConnect = stageStatus === 'countdown' || stageStatus === 'live';

    if (!shouldConnect) {
      if (audioRoomRef.current) {
        const room = audioRoomRef.current;
        audioRoomRef.current = null;
        disconnectAudio(room);
      }
      return;
    }

    if (audioRoomRef.current || audioConnectingRef.current) return;

    const myUid = getMyQueueId();
    const iAmSpeaker = !!(myUid && currentSpeaker?.id === myUid);

    audioConnectingRef.current = true;
    const connectPromise = iAmSpeaker ? connectAsSpeaker(myUid) : connectAsListener();

    connectPromise
      .then((room) => {
        audioConnectingRef.current = false;
        // 接続完了までの間に状態が変わってしまっていたら、繋いだ直後でも切断する
        if (!room) return;
        const stillShouldConnect = stageStatus === 'countdown' || stageStatus === 'live';
        if (!stillShouldConnect) {
          disconnectAudio(room);
          return;
        }
        audioRoomRef.current = room;
      })
      .catch((e) => {
        audioConnectingRef.current = false;
        console.error('[liveAudio] 接続に失敗しました', e);
      });
  }, [stageStatus, currentSpeaker?.id]);

  // 画面自体が閉じられた場合の後始末
  useEffect(() => {
    return () => {
      if (audioRoomRef.current) {
        disconnectAudio(audioRoomRef.current);
        audioRoomRef.current = null;
      }
    };
  }, []);

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

      {Platform.OS === 'web' && stageImageUriWeb ? (
        <View
          style={[
            styles.stage,
            {
              backgroundImage: `url(${stageImageUriWeb})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center center',
              backgroundRepeat: 'no-repeat',
            },
          ]}
        >
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
        </View>
      ) : (
        <ImageBackground source={stageImageSource} style={styles.stage} resizeMode="cover">
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
      )}

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
  stage:         { flex: 1, minHeight: 220, position: 'relative', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
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
  actionArea:    { padding: 14, paddingBottom: 8, gap: 8 },
  queueBox:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 8, padding: 10, gap: 8 },
  queueDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e24b4a' },
  queueText:     { fontSize: 12, color: '#aaa', flex: 1 },
  queueNum:      { fontSize: 12, fontWeight: '500', color: '#fff' },
  btnMain:       { backgroundColor: '#6b1a2a', borderRadius: 8, padding: 14, alignItems: 'center' },
  btnMainText:   { fontSize: 15, fontWeight: '500', color: '#fff' },
});
