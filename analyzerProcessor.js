// Analyzer 音響処理部分（Analyser管理）
class AnalyzerProcessor {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.mixAnalyser = null;
        this.dataArray = null;
    }
    
    setup(mixNode) {
        // Mix後のAnalyserを作成
        this.mixAnalyser = this.audioContext.createAnalyser();
        this.mixAnalyser.fftSize = 2048;
        this.mixAnalyser.smoothingTimeConstant = 0.8;
        
        if (mixNode) {
            mixNode.connect(this.mixAnalyser);
        }
        
        const bufferLength = this.mixAnalyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);
    }
    
    getFrequencyData() {
        if (!this.mixAnalyser || !this.dataArray) return null;
        
        this.mixAnalyser.getByteFrequencyData(this.dataArray);
        return this.dataArray;
    }
    
    getAnalyser() {
        return this.mixAnalyser;
    }
}
