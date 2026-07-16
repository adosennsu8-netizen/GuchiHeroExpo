// src/components/QuickComments.js
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const QUICK = ['👏 拍手', '共感', 'かなしい', 'がんばれ', 'すごい'];

export default function QuickComments({ onSend }) {
  const [text, setText] = useState('');

  const handleSend = (msg) => {
    if (!msg.trim()) return;
    onSend(msg.trim());
    setText('');
  };

  // 改行文字が紛れ込んだ場合（貼り付け等）は空白に置き換えて除去
  const handleChangeText = (t) => {
    setText(t.replace(/[\r\n]+/g, ' '));
  };

  return (
    <View style={styles.wrap}>
      {/* 既定コメントボタン */}
      <View style={styles.quickRow}>
        {QUICK.map(q => (
          <TouchableOpacity key={q} style={styles.quickBtn} onPress={() => handleSend(q)} activeOpacity={0.7}>
            <Text style={styles.quickText}>{q}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* テキスト入力 */}
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
