// src/screens/WaitingScreen.js
import { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { leaveQueue, subscribeStage } from '../services/firebase';
import { getGhostViewerCount } from '../services/ghostAudience';
import { clearMyQueueId } from '../services/myQueueId';

export default function WaitingScreen({ route, navigation }) {
  const { heroName, voiceType, uid } = route.params;
  const [stage, setStage] = useState(null);
  const [viewerCount, setViewerCount] = useState(getGhostViewerCount());

  useEffect(() => {
    const unsub = subscribeStage((s) => {
      setStage(s);
      if (s?.viewerCount > 0) setViewerCount(s.viewerCount);

      // 「タップしてスタート」の確認自体は、どの画面からでも操作できる
      // 全画面共通のオーバーレイ（App.js側）で行う。ここではcountdown/liveに
      // 進んだのを検知したら、舞台画面へ移動するだけでよい。
      if (
        s?.currentSpeaker?.id === uid &&
        (s.status === 'countdown' || s.status === 'live')
      ) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'StageTab' }],
        });
      }
    });
    return () => unsub();
  }, []);

  const handleLeave = async () => {
    await leaveQueue(uid);
    clearMyQueueId();
    navigation.goBack();
  };

  const queueList = stage?.queue ? Object.values(stage.queue).sort((a, b) => a.joinedAt - b.joinedAt) : [];
  const myPosition = queueList.findIndex(q => q.heroName === heroName) + 1;
  const nextSpeaker = queueList[0];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>愚痴HERO</Text>
        <Text style={styles.subtitle}>次のステージまでお待ちください</Text>
      </View>

      <View style={styles.stage}>
        <View style={styles.curtainLeft} />
        <View style={styles.curtainRight} />
        <Text style={styles.stageEmoji}>🎭</Text>
        <Text style={styles.stageLabel}>幕間</Text>
      </View>

      <View style={styles.adPlaceholder}>
        <Text style={styles.adText}>AD</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>🔔 もうすぐあなたの番です</Text>
        </View>

        {nextSpeaker && (
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>次の発表者</Text>
            <Text style={styles.infoValue}>{nextSpeaker.heroName}</Text>
          </View>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>あなたの順番 / 視聴中</Text>
          <Text style={styles.infoValue}>{myPosition}番目 / {viewerCount}人</Text>
        </View>

        <TouchableOpacity style={styles.btnLeave} onPress={handleLeave}>
          <Text style={styles.btnLeaveText}>立候補をキャンセル</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0f0f0f' },
  header:         { padding: 12, backgroundColor: '#1a1a1a', borderBottomWidth: 0.5, borderBottomColor: '#333' },
  title:          { fontSize: 16, fontWeight: '500', color: '#fff' },
  subtitle:       { fontSize: 11, color: '#888', marginTop: 2 },
  stage:          { height: 160, backgroundColor: '#1a1020', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  curtainLeft:    { position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', backgroundColor: '#6b1a2a', borderBottomRightRadius: 40 },
  curtainRight:   { position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', backgroundColor: '#6b1a2a', borderBottomLeftRadius: 40 },
  stageEmoji:     { fontSize: 40, zIndex: 5 },
  stageLabel:     { color: '#aaa', fontSize: 13, marginTop: 6, zIndex: 5 },
  adPlaceholder:  { backgroundColor: '#111', borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#333', padding: 12, alignItems: 'center' },
  adText:         { fontSize: 11, color: '#555' },
  content:        { padding: 16, gap: 10 },
  noticeBox:      { backgroundColor: 'rgba(24,95,165,0.15)', borderWidth: 0.5, borderColor: '#185FA5', borderRadius: 8, padding: 10 },
  noticeText:     { fontSize: 12, color: '#85B7EB' },
  infoBox:        { backgroundColor: '#1a1a1a', borderWidth: 0.5, borderColor: '#333', borderRadius: 8, padding: 12 },
  infoLabel:      { fontSize: 11, color: '#888', marginBottom: 4 },
  infoValue:      { fontSize: 14, fontWeight: '500', color: '#fff' },
  btnLeave:       { alignItems: 'center', padding: 12 },
  btnLeaveText:   { fontSize: 13, color: '#888' },
});
