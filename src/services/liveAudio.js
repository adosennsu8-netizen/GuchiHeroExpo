// src/services/liveAudio.js
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';
import { app } from './firebase';
import { getCachedMicStream, requestMicPermission } from './micStream';

const functions = getFunctions(app, 'asia-southeast1');
const getLiveKitTokenFn = httpsCallable(functions, 'getLiveKitToken');

let Room = null;
let RoomEvent = null;
let Track = null;
if (Platform.OS === 'web') {
  const livekit = require('livekit-client');
  Room = livekit.Room;
  RoomEvent = livekit.RoomEvent;
  Track = livekit.Track;
}

// 現状は「ピッチ高め」のみ対応。声色を増やす際はここに分岐を追加する。
const PITCH_RATIO = 1.4;

const audioElements = new Map();

function attachRemoteAudio(track, participantIdentity) {
  const el = track.attach();
  el.autoplay = true;
  el.style.display = 'none';
  document.body.appendChild(el);
  audioElements.set(participantIdentity, el);
}

function detachAllAudio() {
  for (const el of audioElements.values()) el.remove();
  audioElements.clear();
}

function setupListenerEvents(room) {
  room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
    if (track.kind === 'audio') attachRemoteAudio(track, participant.identity);
  });
  room.on(RoomEvent.TrackUnsubscribed, (_track, _publication, participant) => {
    const el = audioElements.get(participant.identity);
    if (el) { el.remove(); audioElements.delete(participant.identity); }
  });
}

// マイク → ピッチシフト(AudioWorklet) → 変換後トラック、という音声処理チェーンを組み立てる
async function buildPitchShiftedTrack() {
  const micStream = getCachedMicStream() || (await requestMicPermission());

  const audioContext = new AudioContext();
  // ユーザー操作から離れたタイミングでAudioContextが生成されるとsuspendedのまま
  // 無音になることがあるため、明示的にresumeしておく(Androidで音が出ない事例の対策)
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  await audioContext.audioWorklet.addModule('/pitch-processor.js');

  const sourceNode = audioContext.createMediaStreamSource(micStream);
  const pitchNode = new AudioWorkletNode(audioContext, 'pitch-shift-processor');
  pitchNode.port.postMessage({ pitchRatio: PITCH_RATIO });
  const destNode = audioContext.createMediaStreamDestination();

  sourceNode.connect(pitchNode).connect(destNode);

  const processedTrack = destNode.stream.getAudioTracks()[0];
  return { processedTrack, audioContext, sourceNode, pitchNode, destNode };
}

export async function connectAsSpeaker(uid) {
  if (Platform.OS !== 'web' || !Room) {
    console.warn('[liveAudio] Web以外では音声配信は未対応です');
    return null;
  }

  const { data } = await getLiveKitTokenFn({ role: 'speaker', uid });
  const room = new Room();
  await room.connect(data.url, data.token);

  const chain = await buildPitchShiftedTrack();
  await room.localParticipant.publishTrack(chain.processedTrack, {
    source: Track?.Source?.Microphone,
    name: 'microphone',
  });

  // disconnectAudio側で音声処理チェーンも一緒に片付けられるよう、roomに持たせておく
  room.__pitchChain = chain;

  console.log('[liveAudio] 発表者としてLiveKitに接続、ピッチシフト後の音声を配信開始');
  return room;
}

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

export async function disconnectAudio(room) {
  if (!room) return;
  try {
    detachAllAudio();

    if (room.__pitchChain) {
      const { audioContext, sourceNode, pitchNode, destNode } = room.__pitchChain;
      try { sourceNode.disconnect(); } catch (_e) {}
      try { pitchNode.disconnect(); } catch (_e) {}
      try { destNode.disconnect(); } catch (_e) {}
      try { await audioContext.close(); } catch (_e) {}
      room.__pitchChain = null;
    }

    await room.disconnect();
    console.log('[liveAudio] LiveKitから切断');
  } catch (e) {
    console.error('[liveAudio] 切断時にエラー', e);
  }
}