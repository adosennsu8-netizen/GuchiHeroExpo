// src/screens/WallScreen.js
import { getDatabase, onValue, push, ref, remove } from 'firebase/database';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import StagePopup from '../components/StagePopup';

const EXPIRE_MS = 30 * 60 * 1000;
const SPRAY_COLORS = [
  '#FF3B3B', '#FF9500', '#FFD60A', '#30D158', '#64D2FF',
  '#BF5AF2', '#FF375F', '#FFFFFF', '#AC8E68',
];

const getRandomColor = () => SPRAY_COLORS[Math.floor(Math.random() * SPRAY_COLORS.length)];
const getRandomAngle = () => (Math.random() - 0.5) * 8;

export default function WallScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [stageStarted, setStageStarted] = useState(false);
  const db = getDatabase();

  useEffect(() => {
    const wallRef = ref(db, 'wall');
    const unsub = onValue(wallRef, (snap) => {
      const data = snap.val();
      if (!data) return setPosts([]);
      const now = Date.now();
      const list = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .filter(p => now - p.createdAt < EXPIRE_MS)
        .sort((a, b) => b.createdAt - a.createdAt);
      setPosts(list);
      Object.entries(data).forEach(([id, v]) => {
        if (now - v.createdAt >= EXPIRE_MS) remove(ref(db, `wall/${id}`));
      });
    });

    const stageRef = ref(db, 'stage/status');
    const unsubStage = onValue(stageRef, (snap) => {
      if (snap.val() === 'countdown') {
        setStageStarted(true);
        setTimeout(() => setStageStarted(false), 3000);
      }
    });

    return () => { unsub(); unsubStage(); };
  }, []);

  const handlePost = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    await push(ref(db, 'wall'), {
      text: text.trim(),
      color: getRandomColor(),
      angle: getRandomAngle(),
      createdAt: Date.now(),
    });
    setText('');
    setPosting(false);
  };

  const handleLongPress = () => {
    Alert.alert('通報', 'この投稿を通報しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '通報する', style: 'destructive', onPress: () => {} },
    ]);
  };

  const remainingTime = (createdAt) => {
    const elapsed = Date.now() - createdAt;
    const remaining = Math.max(0, EXPIRE_MS - elapsed);
    const mins = Math.floor(remaining / 60000);
    return `${mins}分後に消える`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StagePopup
        visible={stageStarted}
        onPress={() => {
          setStageStarted(false);
          navigation.getParent()?.navigate('StageTab');
        }}
      />
      <ImageBackground
        source={require('../../assets/wall.png')}
        style={styles.bg}
        resizeMode="cover"
      >
        <View style={styles.overlay} />

        <View style={styles.header}>
          <Text style={styles.title}>壁書き</Text>
          <Text style={styles.subtitle}>30分で消える • 匿名</Text>
        </View>

        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity onLongPress={handleLongPress} activeOpacity={0.8}>
              <View style={[styles.post, { transform: [{ rotate: `${item.angle}deg` }] }]}>
                <Text style={[styles.postText, { color: item.color }]}>{item.text}</Text>
                <Text style={styles.expire}>{remainingTime(item.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>誰も書いていない{'\n'}最初に壁に刻め</Text>
            </View>
          }
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.inputWrap}
        >
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="壁に刻め..."
              placeholderTextColor="#666"
              multiline
              maxLength={140}
            />
            <TouchableOpacity
              style={[styles.postBtn, (!text.trim() || posting) && styles.postBtnDisabled]}
              onPress={handlePost}
              disabled={!text.trim() || posting}
            >
              <Text style={styles.postBtnText}>書く</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.charCount}>{text.length}/140</Text>
        </KeyboardAvoidingView>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#000' },
  bg:              { flex: 1 },
  overlay:         { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  header:          { padding: 14, paddingTop: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.1)' },
  title:           { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: 2 },
  subtitle:        { fontSize: 11, color: '#888', marginTop: 2 },
  list:            { flex: 1 },
  listContent:     { padding: 14, gap: 12 },
  post:            { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 4, padding: 12, borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.2)' },
  postText:        { fontSize: 15, fontWeight: '700', lineHeight: 22, fontStyle: 'italic' },
  expire:          { fontSize: 10, color: '#555', marginTop: 6 },
  empty:           { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText:       { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 24 },
  inputWrap:       { padding: 12, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.7)' },
  inputRow:        { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  input:           { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, maxHeight: 100, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)' },
  postBtn:         { backgroundColor: '#FF3B3B', borderRadius: 8, padding: 12, paddingHorizontal: 16, justifyContent: 'center' },
  postBtnDisabled: { backgroundColor: '#333' },
  postBtnText:     { color: '#fff', fontWeight: '700', fontSize: 14 },
  charCount:       { fontSize: 10, color: '#555', textAlign: 'right', marginTop: 4 },
});
