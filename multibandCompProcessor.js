// 3-Band MultiBand Comp 音響処理部分
class MultiBandCompProcessor {
    constructor(audioContext) {
        this.audioContext = audioContext;
        
        // バンド分割用のフィルター
        this.lowFilter = null;
        this.midFilter = null;
        this.highFilter = null;
        
        // コンプレッサー（DynamicsCompressorNodeを使用）
        this.lowComp = null;
        this.midComp = null;
        this.highComp = null;
        
        // Mix用のGainノード
        this.dryGain = null;
        this.wetGain = null;
        this.outputGain = null;
        
        this.params = {
            low: { up: 0, down: 0 },
            mid: { up: 0, down: 0 },
            high: { up: 0, down: 0 },
            mix: 100
        };
        
        this.setupFilters();
    }
    
    setupFilters() {
        if (!this.audioContext) return;
        
        // ローパスフィルター（低域用）
        this.lowFilter = this.audioContext.createBiquadFilter();
        this.lowFilter.type = 'lowpass';
        this.lowFilter.frequency.value = 250;
        this.lowFilter.Q.value = 1;
        
        // ハイパスフィルター（高域用）
        this.highFilter = this.audioContext.createBiquadFilter();
        this.highFilter.type = 'highpass';
        this.highFilter.frequency.value = 4000;
        this.highFilter.Q.value = 1;
        
        // ミッドバンドはバンドパスフィルターで実現
        this.midFilter = this.audioContext.createBiquadFilter();
        this.midFilter.type = 'bandpass';
        this.midFilter.frequency.value = 1000;
        this.midFilter.Q.value = 1;
        
        // コンプレッサーを作成
        this.lowComp = this.audioContext.createDynamicsCompressor();
        this.midComp = this.audioContext.createDynamicsCompressor();
        this.highComp = this.audioContext.createDynamicsCompressor();
        
        // Gainノードを作成
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
        this.outputGain = this.audioContext.createGain();
    }
    
    updateMultiBandComp(params) {
        this.params = params;
        
        // コンプレッサーのパラメータを更新
        // Up/Down Compの実装（簡易版）
        if (this.lowComp) {
            this.lowComp.threshold.value = -24;
            this.lowComp.knee.value = 30;
            this.lowComp.ratio.value = 4;
            this.lowComp.attack.value = 0.003;
            this.lowComp.release.value = 0.25;
        }
        
        if (this.midComp) {
            this.midComp.threshold.value = -24;
            this.midComp.knee.value = 30;
            this.midComp.ratio.value = 4;
            this.midComp.attack.value = 0.003;
            this.midComp.release.value = 0.25;
        }
        
        if (this.highComp) {
            this.highComp.threshold.value = -24;
            this.highComp.knee.value = 30;
            this.highComp.ratio.value = 4;
            this.highComp.attack.value = 0.003;
            this.highComp.release.value = 0.25;
        }
        
        // Mix割合を設定
        const mixRatio = params.mix / 100;
        if (this.dryGain) {
            this.dryGain.gain.value = 1 - mixRatio;
        }
        if (this.wetGain) {
            this.wetGain.gain.value = mixRatio;
        }
    }
    
    // オーディオノードを接続
    connect(inputNode, outputNode) {
        if (!inputNode || !outputNode) return;
        
        // 入力から各バンドに分岐
        const lowBranch = this.audioContext.createGain();
        const midBranch = this.audioContext.createGain();
        const highBranch = this.audioContext.createGain();
        
        inputNode.connect(lowBranch);
        inputNode.connect(midBranch);
        inputNode.connect(highBranch);
        
        // 各バンドをフィルターとコンプレッサーに通す
        lowBranch.connect(this.lowFilter);
        this.lowFilter.connect(this.lowComp);
        
        midBranch.connect(this.midFilter);
        this.midFilter.connect(this.midComp);
        
        highBranch.connect(this.highFilter);
        this.highFilter.connect(this.highComp);
        
        // 各バンドをMix用のGainノードに接続
        this.lowComp.connect(this.wetGain);
        this.midComp.connect(this.wetGain);
        this.highComp.connect(this.wetGain);
        
        // DryとWetをMix
        inputNode.connect(this.dryGain);
        this.dryGain.connect(this.outputGain);
        this.wetGain.connect(this.outputGain);
        
        // 出力に接続
        this.outputGain.connect(outputNode);
    }
    
    getInputNode() {
        return this.outputGain;
    }
    
    getOutputNode() {
        return this.outputGain;
    }
}
