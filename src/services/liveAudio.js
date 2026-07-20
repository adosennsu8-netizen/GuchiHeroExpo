// src/services/liveAudio.js
// LiveKitを使った1対多の音声配信（発表者 → 視聴者）。
// livekit-clientはブラウザのWebRTC APIに依存するため、Web版でのみ動作する。
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';
import { app } from './firebase';

// Firebase Functionsはasia-southeast1にデプロイしているため、クライアント側もリージョンを合わせる
const functions = getFunctions(app, 'asia-southeast1');
const getLiveKitTokenFn = httpsCallable(functions, 'getLiveKitToken');

// livekit-clientはブラウザ専用のためWeb以外では読み込まない（ネイティブ環境での起動エラーを防ぐ）
let Room = null;
let RoomEvent = null;
if (Platform.OS === 'web') {
  const livekit = require('livekit-client');
  Room = livekit.Room;
  RoomEvent = livekit.RoomEvent;
}

// リモート（相手）の音声トラックを実際にブラウザで再生するための<audio>要素を管理する
const audioElements = new Map();

function attachRemoteAudio(track, participantIdentity) {
  const el = track.attach();
  el.autoplay = true;
  el.style.display = 'none';
  document.body.appendChild(el);
  audioElements.set(participantIdentity, el);
}

function detachAllAudio() {
  for (const el of audioElements.values()) {
    el.remove();
  }
  audioElements.clear();
}

function setupListenerEvents(room) {
  room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
    if (track.kind === 'audio') {
      attachRemoteAudio(track, participant.identity);
    }
  });
  room.on(RoomEvent.TrackUnsubscribed, (_track, _publication, participant) => {
    const el = audioElements.get(participant.identity);
    if (el) {
      el.remove();
      audioElements.delete(participant.identity);
    }
  });
}

// 発表者として接続し、マイクを配信する。
// uidは/stage/currentSpeaker.idと一致している必要があり、サーバー側(getLiveKitToken)で検証される。
export async function connectAsSpeaker(uid) {
  if (Platform.OS !== 'web' || !Room) {
    console.warn('[liveAudio] Web以外では音声配信は未対応です');
    return null;
  }

  const { data } = await getLiveKitTokenFn({ role: 'speaker', uid });
  const room = new Room();
  await room.connect(data.url, data.token);
  await room.localParticipant.setMicrophoneEnabled(true);
  console.log('[liveAudio] 発表者としてLiveKitに接続、マイク配信開始');
  return room;
}

// 視聴者として接続し、発表者の音声を再生する
export async function connectAsListener() {
  if (Platform.OS !== 'web' || !Room) {
    console.warn('[liveAudio] Web以外では音声視聴は未対応です');
    return null;
  }

  const { data } = await getLiveKitTokenFn({ role: 'listener' });
  const room = new Room();
  setupListenerEvents(room);
  await room.connect(data.url, data.token);
  console.log('[liveAudio] 視聴者としてLiveKitに接続');
  return room;
}

// 切断（発表者・視聴者共通）
export async function disconnectAudio(room) {
  if (!room) return;
  try {
    detachAllAudio();
    await room.disconnect();
    console.log('[liveAudio] LiveKitから切断');
  } catch (e) {
    console.error('[liveAudio] 切断時にエラー', e);
  }
}
