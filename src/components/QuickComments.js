// src/components/QuickComments.js
import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const QUICK = ['👏 拍手', '共感', 'かなしい', 'がんばれ', 'すごい'];

// Web版はAlert.alertが正しく表示されないため、window.alertに切り替える
// (壁書きの通報確認をwindow.confirmに切り替えた時と同じ理由)
function showAlert(title, message) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function QuickComments({ onSend }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async (msg) => {
    if (!msg.trim() || sending) return;
    setSending(true);
    try {
      await onSend(msg.trim());
      setText('');
    } catch (e) {
      if (e?.code === 'NG_WORD_DETECTED') {
        showAlert('送信できません', '不適切な内容が含まれている可能性があります。表現を変えてもう一度お試しください。');
      } else {
        showAlert('エラー', 'コメントの送信に失敗しました。もう一度お試しください。');
      }
    } finally {
      setSending(false);
    }
  };

  const handleChangeText = (t) => {
    setText(t.replace(/[\r\n]+/g, ' '));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.quickRow}>
        {QUICK.map(q => (
          <TouchableOpacity key={q} style={styles.quickBtn} onPress={() => handleSend(q)} activeOpacity={0.7}>
            <Text style={styles.quickText}>{q}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={handleChangeText}
          placeholder="コメントを入力..."
          placeholderTextColor="#555"
          returnKeyType="send"
          onSubmitEditing={() => handleSend(text)}
          maxLength={40}
          multiline={false}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={() => handleSend(text)} activeOpacity={0.8}>
          <Text style={styles.sendText}>送信</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:      { gap: 8 },
  quickRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quickBtn:  { backgroundColor: '#1e1e1e', borderWidth: 0.5, borderColor: '#444', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  quickText: { fontSize: 12, color: '#ccc' },
  inputRow:  { flexDirection: 'row', gap: 8 },
  input:     { flex: 1, backgroundColor: '#1a1a1a', borderWidth: 0.5, borderColor: '#333', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#fff', fontSize: 13 },
  sendBtn:   { backgroundColor: '#6b1a2a', borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  sendText:  { color: '#fff', fontSize: 13, fontWeight: '500' },
});