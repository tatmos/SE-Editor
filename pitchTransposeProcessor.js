// ピッチトランスポーズ 音響処理部分
class PitchTransposeProcessor {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.track1Params = { transpose: 0, cent: 0 };
        this.track2Params = { transpose: 0, cent: 0 };
    }
    
    setPitchShift(trackNumber, transpose, cent) {
        if (trackNumber === 1) {
            this.track1Params = { transpose, cent };
        } else if (trackNumber === 2) {
            this.track2Params = { transpose, cent };
        }
    }
    
    // ピッチシフトを適用したバッファを生成
    applyPitchShift(audioBuffer, trackNumber) {
        const params = trackNumber === 1 ? this.track1Params : this.track2Params;
        
        if (params.transpose === 0 && params.cent === 0) {
            return audioBuffer; // ピッチシフトなし
        }
        
        // セミトーンとcentから周波数比を計算
        const semitoneRatio = Math.pow(2, params.transpose / 12);
        const centRatio = Math.pow(2, params.cent / 1200);
        const pitchRatio = semitoneRatio * centRatio;
        
        // ピッチシフトを適用（タイムストレッチを使用）
        return this.pitchShiftBuffer(audioBuffer, pitchRatio);
    }
    
    // バッファにピッチシフトを適用（簡易実装）
    pitchShiftBuffer(audioBuffer, pitchRatio) {
        const sampleRate = this.audioContext.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;
        const newLength = Math.floor(length / pitchRatio);
        
        const newBuffer = this.audioContext.createBuffer(numChannels, newLength, sampleRate);
        
        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = newBuffer.getChannelData(channel);
            
            for (let i = 0; i < newLength; i++) {
                const sourceIndex = i * pitchRatio;
                const index1 = Math.floor(sourceIndex);
                const index2 = Math.min(index1 + 1, length - 1);
                const fraction = sourceIndex - index1;
                
                // 線形補間
                outputData[i] = inputData[index1] * (1 - fraction) + inputData[index2] * fraction;
            }
        }
        
        return newBuffer;
    }
}
