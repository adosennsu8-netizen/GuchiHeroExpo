// src/screens/VoiceSelectScreen.js
import { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { joinQueue } from '../services/firebase';
import { setMyQueueId } from '../services/myQueueId';
import { getPushToken } from '../services/pushToken';

const VOICE_TYPES = [
  { id: 'robot', label: 'ロボット',   desc: '機械的な声に変換' },
  { id: 'high',  label: 'ピッチ高め', desc: '高めのトーンに変換' },
  { id: 'low',   label: 'ピッチ低め', desc: '低めのトーンに変換' },
  { id: 'echo',  label: 'エコー',     desc: '残響のある声に変換' },
];

export default function VoiceSelectScreen({ route, navigation }) {
  const { heroName } = route.params;
  const [selected, setSelected] = useState('robot');

  const handleJoin = async () => {
    try {
      // 立候補する時点で自分の通知トークンも一緒に保存しておく。
      // これが無いと「もうすぐあなたの番です」という通知が送られる先が存在せず、
      // サーバー側の通知処理自体は正しくても実際には誰にも届かなかった。
      const uid = await joinQueue(heroName, getPushToken());
      setMyQueueId(uid);
      navigation.replace('Waiting', { heroName, voiceType: selected, uid });
    } catch (e) {
      Alert.alert('エラー', '立候補に失敗しました。もう一度お試しください。');
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

        {VOICE_TYPES.map(v => (
          <TouchableOpacity
            key={v.id}
            style={[styles.option, selected === v.id && styles.optionSel]}
            onPress={() => setSelected(v.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.radio, selected === v.id && styles.radioSel]} />
            <View>
              <Text style={styles.optLabel}>{v.label}</Text>
              <Text style={styles.optDesc}>{v.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.nameBox}>
          <Text style={styles.nameLabel}>あなたは</Text>
          <Text style={styles.nameValue}>{heroName}</Text>
          <Text style={styles.nameSub}>として登場します</Text>
        </View>

        <TouchableOpacity style={styles.btnMain} onPress={handleJoin} activeOpacity={0.8}>
          <Text style={styles.btnMainText}>この声で立候補する</Text>
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
  option:      { flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderColor: '#333', borderRadius: 8, padding: 12, marginBottom: 8, gap: 12 },
  optionSel:   { borderColor: '#6b1a2a', backgroundColor: 'rgba(107,26,42,0.1)' },
  radio:       { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#555' },
  radioSel:    { borderColor: '#6b1a2a', backgroundColor: '#6b1a2a' },
  optLabel:    { fontSize: 13, fontWeight: '500', color: '#fff' },
  optDesc:     { fontSize: 11, color: '#888', marginTop: 2 },
  nameBox:     { backgroundColor: '#1a1a1a', borderRadius: 8, padding: 12, marginVertical: 16 },
  nameLabel:   { fontSize: 11, color: '#888' },
  nameValue:   { fontSize: 14, fontWeight: '500', color: '#fff', marginTop: 4 },
  nameSub:     { fontSize: 11, color: '#888', marginTop: 2 },
  btnMain:     { backgroundColor: '#6b1a2a', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 8 },
  btnMainText: { fontSize: 15, fontWeight: '500', color: '#fff' },
  btnBack:     { alignItems: 'center', padding: 10 },
  btnBackText: { fontSize: 13, color: '#888' },
});
