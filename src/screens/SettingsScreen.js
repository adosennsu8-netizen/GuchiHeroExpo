// src/screens/SettingsScreen.js
import { Linking, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
const ROWS = [
  {
    section: 'アプリについて',
    items: [
      { label: '使い方',             sub: '愚痴HEROの基本的な使い方', onPress: () => {} },
      { label: 'プライバシーポリシー', sub: '声データの取り扱いについて', onPress: () => Linking.openURL('https://guchihero-legal.vercel.app/privacy.html') },
      { label: '利用規約', sub: null, onPress: () => Linking.openURL('https://guchihero-legal.vercel.app/terms.html') },
    ],
  },
  {
    section: 'サポート',
    items: [
      { label: 'お問い合わせ',              sub: null, onPress: () => Linking.openURL('mailto:support@guchihero.app') },
      { label: '不適切なコンテンツを報告', sub: null, onPress: () => {} },
    ],
  },
];

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>設定</Text>
      </View>
      {ROWS.map(group => (
        <View key={group.section}>
          <Text style={styles.sectionLabel}>{group.section}</Text>
          {group.items.map(item => (
            <TouchableOpacity key={item.label} style={styles.row} onPress={item.onPress} activeOpacity={0.6}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                {item.sub && <Text style={styles.rowSub}>{item.sub}</Text>}
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <Text style={styles.version}>愚痴HERO v1.0.0</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0f0f0f' },
  header:       { padding: 16, backgroundColor: '#1a1a1a', borderBottomWidth: 0.5, borderBottomColor: '#333' },
  title:        { fontSize: 16, fontWeight: '500', color: '#fff' },
  sectionLabel: { fontSize: 11, color: '#888', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  row:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: '#222' },
  rowText:      { flex: 1 },
  rowLabel:     { fontSize: 14, color: '#fff' },
  rowSub:       { fontSize: 11, color: '#888', marginTop: 2 },
  chevron:      { fontSize: 20, color: '#555' },
  version:      { fontSize: 11, color: '#555', textAlign: 'center', marginTop: 32 },
});
