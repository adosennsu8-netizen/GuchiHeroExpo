// src/screens/VoiceSelectScreen.js
import { useState } from 'react';
import { Alert, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { joinQueue } from '../services/firebase';
import { requestMicPermission } from '../services/micStream';
import { setMyQueueId } from '../services/myQueueId';
import { getPushToken } from '../services/pushToken';

// 現状は「ピッチ高め」のみ対応。ロボット/ピッチ低め/エコーは、
// これの動作確認が取れてから順次追加する。
const VOICE_TYPE = { id: 'high', label: 'ピッチ高め', desc: '高めのトーンに変換されます' };

export default function VoiceSelectScreen({ route, navigation }) {
  const { heroName } = route.params;
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    if (joining) return;
    setJoining(true);

    try {
      // 立候補ボタンを押したこの瞬間にマイク許可を先に取っておく。
      // 発表開始のタイミングで初めて許可を求めると、許可待ちの間に
      // カウントダウンや発表時間が進んでしまうため、ここで済ませる。
      if (Platform.OS === 'web') {
        try {
          await requestMicPermission();
        } catch (e) {
          Alert.alert(
            'マイクの許可が必要です',
            '発表するにはマイクへのアクセスを許可してください。ブラウザの設定から許可してから、もう一度お試しください。'
          );
          setJoining(false);
          return;
        }
      }

      const uid = await joinQueue(heroName, getPushToken());
      setMyQueueId(uid);
      navigation.replace('Waiting', { heroName, voiceType: VOICE_TYPE.id, uid });
    } catch (e) {
      Alert.alert('エラー', '立候補に失敗しました。もう一度お試しください。');
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>声を選んでください</Text>
        <Text style={styles.subtitle}>発表中は選択した声に変換されます</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.note}>プライバシー保護のため声は必ず変換されます</Text>

        <View style={[styles.option, styles.optionSel]}>
          <View style={[styles.radio, styles.radioSel]} />
          <View>
            <Text style={styles.optLabel}>{VOICE_TYPE.label}</Text>
            <Text style={styles.optDesc}>{VOICE_TYPE.desc}</Text>
          </View>
        </View>
        <Text style={styles.comingSoon}>他の声色は準備中です</Text>

        <View style={styles.nameBox}>
          <Text style={styles.nameLabel}>あなたは</Text>
          <Text style={styles.nameValue}>{heroName}</Text>
          <Text style={styles.nameSub}>として登場します</Text>
        </View>

        <TouchableOpacity
          style={[styles.btnMain, joining && styles.btnMainDisabled]}
          onPress={handleJoin}
          activeOpacity={0.8}
          disabled={joining}
        >
          <Text style={styles.btnMainText}>{joining ? 'マイク準備中...' : 'この声で立候補する'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.btnBack}>
          <Text style={styles.btnBackText}>キャンセル</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0f0f0f' },
  header:      { padding: 16, backgroundColor: '#1a1a1a', borderBottomWidth: 0.5, borderBottomColor: '#333' },
  title:       { fontSize: 16, fontWeight: '500', color: '#fff' },
  subtitle:    { fontSize: 11, color: '#888', marginTop: 2 },
  content:     { padding: 16 },
  note:        { fontSize: 12, color: '#888', marginBottom: 14 },
  option:      { flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderColor: '#333', borderRadius: 8, padding: 12, marginBottom: 4, gap: 12 },
  optionSel:   { borderColor: '#6b1a2a', backgroundColor: 'rgba(107,26,42,0.1)' },
  radio:       { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#555' },
  radioSel:    { borderColor: '#6b1a2a', backgroundColor: '#6b1a2a' },
  optLabel:    { fontSize: 13, fontWeight: '500', color: '#fff' },
  optDesc:     { fontSize: 11, color: '#888', marginTop: 2 },
  comingSoon:  { fontSize: 11, color: '#666', marginBottom: 14 },
  nameBox:     { backgroundColor: '#1a1a1a', borderRadius: 8, padding: 12, marginVertical: 16 },
  nameLabel:   { fontSize: 11, color: '#888' },
  nameValue:   { fontSize: 14, fontWeight: '500', color: '#fff', marginTop: 4 },
  nameSub:     { fontSize: 11, color: '#888', marginTop: 2 },
  btnMain:     { backgroundColor: '#6b1a2a', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 8 },
  btnMainDisabled: { opacity: 0.5 },
  btnMainText: { fontSize: 15, fontWeight: '500', color: '#fff' },
  btnBack:     { alignItems: 'center', padding: 10 },
  btnBackText: { fontSize: 13, color: '#888' },
});