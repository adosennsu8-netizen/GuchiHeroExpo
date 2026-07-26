// src/screens/HowToScreen.js
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const SECTIONS = [
  {
    title: '愚痴HEROとは',
    body:
      '愚痴HEROは、誰でも匿名でステージに立ち、60秒間だけ思い切り愚痴を披露できるアプリです。' +
      '発表者の声はプライバシー保護のため必ず変換されて配信され、個人が特定されることはありません。' +
      '視聴者は流れるコメントや拍手ボタンでリアルタイムに反応でき、発表者を後押しします。' +
      'ログインやアカウント登録は不要で、思い立ったその瞬間に参加できます。',
  },
  {
    title: 'ステージの使い方',
    body:
      '画面下部の「次の発表者に立候補」ボタンを押すと、キューに並びます。' +
      '自分の番が近づくと通知が届き、実際に順番が来ると画面上に「タップしてスタート」というボタンが表示されます。' +
      'このボタンを15秒以内にタップすると、3秒のカウントダウンの後、60秒間の発表が始まります。' +
      '発表中は視聴者からのコメントや拍手がリアルタイムに届きます。時間になると自動的に幕が閉じ、次の発表者へと引き継がれます。',
  },
  {
    title: '壁書きの使い方',
    body:
      '「壁書き」タブでは、匿名の落書きのように短い言葉を書き残せます。' +
      '投稿は30分が経過すると自動的に消えるため、気軽に書き込めます。' +
      '不適切だと感じた投稿があれば、投稿ごとに表示されている「🚩通報」から報告できます。',
  },
  {
    title: '安心してご利用いただくために',
    body:
      '匿名の場であっても、他の利用者を傷つける内容や、違法な行為を助長する内容の投稿は禁止しています。' +
      'そうした投稿は自動的な判定や利用者からの通報によって削除される仕組みになっています。' +
      '安心して愚痴を発散できる場を保つため、ご協力をお願いします。',
  },
  {
    title: 'よくある質問',
    items: [
      {
        q: 'アカウント登録は必要ですか？',
        a: '不要です。アプリを開いてすぐに参加できます。',
      },
      {
        q: '自分の声はそのまま配信されますか？',
        a: 'いいえ。発表中の声は必ず変換されてから届けられ、地声のまま配信されることはありません。',
      },
      {
        q: '発表を途中でやめることはできますか？',
        a: 'ステージに立つ前であれば、待機画面からキャンセルできます。発表が始まった後は60秒間の枠の中で進行します。',
      },
      {
        q: '不適切な投稿を見つけたらどうすればいいですか？',
        a: '壁書きの投稿には「🚩通報」ボタンがあります。3件の通報が集まると自動的に削除されます。ステージのコメントについては、投稿前の自動判定によって不適切な内容は送信できない仕組みになっています。',
      },
    ],
  },
];

export default function HowToScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>使い方</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.body && <Text style={styles.sectionBody}>{section.body}</Text>}
            {section.items && section.items.map((item) => (
              <View key={item.q} style={styles.qaItem}>
                <Text style={styles.qaQ}>Q. {item.q}</Text>
                <Text style={styles.qaA}>A. {item.a}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0f0f0f' },
  header:       { padding: 16, backgroundColor: '#1a1a1a', borderBottomWidth: 0.5, borderBottomColor: '#333' },
  headerTitle:  { fontSize: 16, fontWeight: '500', color: '#fff' },
  content:      { padding: 16, paddingBottom: 32 },
  section:      { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#fac775', marginBottom: 8 },
  sectionBody:  { fontSize: 13, color: '#ccc', lineHeight: 21 },
  qaItem:       { marginBottom: 14 },
  qaQ:          { fontSize: 13, fontWeight: '500', color: '#fff', marginBottom: 4 },
  qaA:          { fontSize: 13, color: '#aaa', lineHeight: 20 },
});