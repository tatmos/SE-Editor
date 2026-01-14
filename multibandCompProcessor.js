// 3-Band MultiBand Comp 音響処理部分
class MultiBandCompProcessor {
    constructor(audioContext) {
        this.audioContext = audioContext;
        
        // バンド分割用のフィルター
        this.lowFilter = null;
        this.midFilter = null;
        this.highFilter = null;
        
        // 各バンド用のゲインノード
        this.lowGain = null;
        this.midGain = null;
        this.highGain = null;
        
        // 入出力ノード
        this.inputGain = null;
        this.outputGain = null;
        
        // Mix用のノード
        this.bypassGain = null;        // バイパス経路のゲイン
        this.effectMixGain = null;     // エフェクト経路のMixゲイン
        this.bypassMixGain = null;     // バイパス経路のMixゲイン
        
        this.params = {
            // 将来的なUp/Down Comp用のパラメータは残しつつ、
            // まずは各バンドのGainだけを利用する
            low:  { up: 0, down: 0, gain: 100 },
            mid:  { up: 0, down: 0, gain: 100 },
            high: { up: 0, down: 0, gain: 100 },
            mix: 100
        };
        
        this.setupFilters();
    }
    
    setupFilters() {
        if (!this.audioContext) return;
        
        // 入出力
        this.inputGain = this.audioContext.createGain();
        this.outputGain = this.audioContext.createGain();

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
        
        // 各バンド用のゲインノード
        this.lowGain = this.audioContext.createGain();
        this.midGain = this.audioContext.createGain();
        this.highGain = this.audioContext.createGain();

        // Mix用のノード
        this.bypassGain = this.audioContext.createGain();
        this.bypassGain.gain.value = 1.0;  // バイパスはそのまま
        
        this.effectMixGain = this.audioContext.createGain();
        this.bypassMixGain = this.audioContext.createGain();

        // ノード接続
        // エフェクト経路: 入力 -> 各フィルター -> 各バンドゲイン -> エフェクトMixゲイン -> 出力
        this.inputGain.connect(this.lowFilter);
        this.inputGain.connect(this.midFilter);
        this.inputGain.connect(this.highFilter);

        this.lowFilter.connect(this.lowGain);
        this.midFilter.connect(this.midGain);
        this.highFilter.connect(this.highGain);

        this.lowGain.connect(this.effectMixGain);
        this.midGain.connect(this.effectMixGain);
        this.highGain.connect(this.effectMixGain);

        // バイパス経路: 入力 -> バイパスゲイン -> バイパスMixゲイン -> 出力
        this.inputGain.connect(this.bypassGain);
        this.bypassGain.connect(this.bypassMixGain);

        // Mix: エフェクト経路とバイパス経路を合算して出力
        this.effectMixGain.connect(this.outputGain);
        this.bypassMixGain.connect(this.outputGain);
    }
    
    updateMultiBandComp(params) {
        this.params = params;
        
        // 各バンドのGainを更新（0–200% を 0.0–2.0 のリニアゲインにマップ）
        const toLinearGain = (percent) => {
            const clamped = Math.max(0, Math.min(200, percent));
            return clamped / 100;
        };

        if (this.lowGain && params.low) {
            const gain = toLinearGain(params.low.gain ?? 100);
            this.lowGain.gain.value = gain;
        }
        if (this.midGain && params.mid) {
            const gain = toLinearGain(params.mid.gain ?? 100);
            this.midGain.gain.value = gain;
        }
        if (this.highGain && params.high) {
            const gain = toLinearGain(params.high.gain ?? 100);
            this.highGain.gain.value = gain;
        }

        // Mix値を更新（0–100% を 0.0–1.0 のリニアゲインにマップ）
        const mix = params.mix ?? 100;
        const clampedMix = Math.max(0, Math.min(100, mix));
        const effectMix = clampedMix / 100;      // エフェクト経路のゲイン
        const bypassMix = (100 - clampedMix) / 100;  // バイパス経路のゲイン

        if (this.effectMixGain) {
            this.effectMixGain.gain.value = effectMix;
        }
        if (this.bypassMixGain) {
            this.bypassMixGain.gain.value = bypassMix;
        }
    }
    
    /**
     * 外部から接続しやすいように、入力ノードを返す
     * - 例: source.connect(mbc.getInputNode());
     */
    getInputNode() {
        return this.inputGain;
    }
    
    /**
     * 外部から接続しやすいように、出力ノードを返す
     * - 例: mbc.getOutputNode().connect(audioContext.destination);
     */
    getOutputNode() {
        return this.outputGain;
    }
}
