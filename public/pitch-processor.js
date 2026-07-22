// public/pitch-processor.js
// リアルタイムのグレイン方式ピッチシフター。
// マイク入力をリングバッファに溜め、書き込みは1サンプルずつ・読み取りは
// pitchRatio倍の速さで進めることで、再生速度を変えずにピッチだけを変化させる。
// 読み取り位置がグレインの端で折り返す瞬間のプツプツ音を消すため、
// 半周期ずらした2つのグレインをハン窓でクロスフェードしている。

class PitchShiftProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pitchRatio = 1.4; // 1.0=変化なし、1.4=ピッチ高め
    this.grainSize = 4096;
    this.bufferSize = this.grainSize * 4;
    this.ringBuffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.grainPos = 0;

    this.window = new Float32Array(this.grainSize);
    for (let i = 0; i < this.grainSize; i++) {
      this.window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / this.grainSize);
    }

    this.port.onmessage = (event) => {
      if (typeof event.data?.pitchRatio === 'number') {
        this.pitchRatio = event.data.pitchRatio;
      }
    };
  }

  _readBuffer(pos) {
    const i0 = Math.floor(pos) % this.bufferSize;
    const i1 = (i0 + 1) % this.bufferSize;
    const frac = pos - Math.floor(pos);
    return this.ringBuffer[i0] * (1 - frac) + this.ringBuffer[i1] * frac;
  }

  process(inputs, outputs) {
    const input = inputs[0][0];
    const output = outputs[0][0];
    if (!input || !output) return true;

    const half = this.grainSize / 2;

    for (let i = 0; i < input.length; i++) {
      this.ringBuffer[this.writeIndex] = input[i];

      const baseReadPos = (this.writeIndex - this.grainSize + this.bufferSize) % this.bufferSize;
      const posA = (baseReadPos + this.grainPos) % this.bufferSize;
      const posB = (baseReadPos + ((this.grainPos + half) % this.grainSize)) % this.bufferSize;

      const sampleA = this._readBuffer(posA);
      const sampleB = this._readBuffer(posB);

      const winIndexA = Math.floor(this.grainPos) % this.grainSize;
      const winIndexB = Math.floor((this.grainPos + half) % this.grainSize);
      const gainA = this.window[winIndexA];
      const gainB = this.window[winIndexB];
      const gainSum = gainA + gainB || 1;

      output[i] = (sampleA * gainA + sampleB * gainB) / gainSum;

      this.grainPos = (this.grainPos + this.pitchRatio) % this.grainSize;
      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
    }

    return true;
  }
}

registerProcessor('pitch-shift-processor', PitchShiftProcessor);