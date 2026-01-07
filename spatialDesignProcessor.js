// 空間デザイン 音響処理部分（パンニング・残響）
class SpatialDesignProcessor {
    constructor(audioContext) {
        this.audioContext = audioContext;
        
        // パンニング用のGainノード
        this.track1PanLeft = null;
        this.track1PanRight = null;
        this.track2PanLeft = null;
        this.track2PanRight = null;
        
        // 残響用のConvolverNode
        this.track1Reverb = null;
        this.track2Reverb = null;
        this.track1ReverbGain = null;
        this.track2ReverbGain = null;
        this.track1DryGain = null;
        this.track2DryGain = null;
        
        this.track1Position = { x: 0, z: 0 };
        this.track2Position = { x: 0, z: 0 };
        this.reverbMix = 0;
        
        this.setupNodes();
    }
    
    setupNodes() {
        if (!this.audioContext) return;
        
        // パンニング用のGainノードを作成
        this.track1PanLeft = this.audioContext.createGain();
        this.track1PanRight = this.audioContext.createGain();
        this.track2PanLeft = this.audioContext.createGain();
        this.track2PanRight = this.audioContext.createGain();
        
        // 残響用のGainノードを作成
        this.track1ReverbGain = this.audioContext.createGain();
        this.track2ReverbGain = this.audioContext.createGain();
        this.track1DryGain = this.audioContext.createGain();
        this.track2DryGain = this.audioContext.createGain();
        
        // 残響用のConvolverNodeを作成（簡易残響）
        this.track1Reverb = this.audioContext.createConvolver();
        this.track2Reverb = this.audioContext.createConvolver();
        
        // 簡易残響インパルスレスポンスを生成
        this.createReverbImpulse();
    }
    
    createReverbImpulse() {
        // 簡易残響インパルスレスポンスを生成
        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * 2; // 2秒
        const impulse = this.audioContext.createBuffer(2, length, sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
            }
        }
        
        if (this.track1Reverb) {
            this.track1Reverb.buffer = impulse;
        }
        if (this.track2Reverb) {
            this.track2Reverb.buffer = impulse;
        }
    }
    
    updateSpatialPosition(track1Position, track2Position, reverbMix) {
        this.track1Position = track1Position;
        this.track2Position = track2Position;
        this.reverbMix = reverbMix;
        
        // パンニングを更新（X座標に基づく）
        if (this.track1PanLeft && this.track1PanRight) {
            const pan1 = (track1Position.x + 1) / 2; // -1から1を0から1に変換
            this.track1PanLeft.gain.value = 1 - pan1;
            this.track1PanRight.gain.value = pan1;
        }
        
        if (this.track2PanLeft && this.track2PanRight) {
            const pan2 = (track2Position.x + 1) / 2;
            this.track2PanLeft.gain.value = 1 - pan2;
            this.track2PanRight.gain.value = pan2;
        }
        
        // 残響Mixを更新（Z座標に基づく距離とMix割合）
        const distance1 = Math.sqrt(track1Position.x * track1Position.x + track1Position.z * track1Position.z);
        const distance2 = Math.sqrt(track2Position.x * track2Position.x + track2Position.z * track2Position.z);
        
        const reverbAmount1 = (distance1 * reverbMix) / 100;
        const reverbAmount2 = (distance2 * reverbMix) / 100;
        
        if (this.track1ReverbGain && this.track1DryGain) {
            this.track1ReverbGain.gain.value = reverbAmount1;
            this.track1DryGain.gain.value = 1 - reverbAmount1;
        }
        
        if (this.track2ReverbGain && this.track2DryGain) {
            this.track2ReverbGain.gain.value = reverbAmount2;
            this.track2DryGain.gain.value = 1 - reverbAmount2;
        }
    }
    
    // トラック1のオーディオノードを接続
    connectTrack1(inputNode, outputNode) {
        if (!inputNode || !outputNode) return;
        
        // 入力からパンニングに分岐
        const splitter = this.audioContext.createChannelSplitter(2);
        inputNode.connect(splitter);
        
        // 左チャンネル
        splitter.connect(this.track1PanLeft, 0);
        this.track1PanLeft.connect(outputNode, 0);
        
        // 右チャンネル
        splitter.connect(this.track1PanRight, 1);
        this.track1PanRight.connect(outputNode, 1);
        
        // 残響経路
        inputNode.connect(this.track1DryGain);
        this.track1DryGain.connect(outputNode);
        
        inputNode.connect(this.track1Reverb);
        this.track1Reverb.connect(this.track1ReverbGain);
        this.track1ReverbGain.connect(outputNode);
    }
    
    // トラック2のオーディオノードを接続
    connectTrack2(inputNode, outputNode) {
        if (!inputNode || !outputNode) return;
        
        // 入力からパンニングに分岐
        const splitter = this.audioContext.createChannelSplitter(2);
        inputNode.connect(splitter);
        
        // 左チャンネル
        splitter.connect(this.track2PanLeft, 0);
        this.track2PanLeft.connect(outputNode, 0);
        
        // 右チャンネル
        splitter.connect(this.track2PanRight, 1);
        this.track2PanRight.connect(outputNode, 1);
        
        // 残響経路
        inputNode.connect(this.track2DryGain);
        this.track2DryGain.connect(outputNode);
        
        inputNode.connect(this.track2Reverb);
        this.track2Reverb.connect(this.track2ReverbGain);
        this.track2ReverbGain.connect(outputNode);
    }
}
