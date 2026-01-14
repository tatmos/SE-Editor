// オーディオ再生クラス
class AudioPlayer {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.sourceNodes = [];
        this.startTime = null;
        this.loopDuration = 0;
        this.gainNode1 = null;
        this.gainNode2 = null;
        this.analyser1 = null;
        this.analyser2 = null;
        this.isPlaying = false;
        this.track1Processor = new Track1Processor(audioContext);
        this.track2Processor = new Track2Processor(audioContext);

        // マスターバス用 3-Band MultiBand Processor
        this.multibandCompProcessor = null;
        this.masterBus = null;
        this.masterAnalyser = null; // マスターバス用のアナライザー（スペクトラム表示用）
    }

    // ループメーカー側からマルチバンドプロセッサーを受け取る
    setMultiBandProcessor(processor) {
        this.multibandCompProcessor = processor;
    }

    // トラック1と2の加工後のバッファを再生（トラック1の加工後の範囲でループ）
    // offsetSeconds: 再生開始位置（秒）
    playPreviewWithBuffers(track1Buffer, track2Buffer, offsetSeconds = 0) {
        if (!track1Buffer || !track2Buffer || this.isPlaying) return false;

        try {
            // トラック1の加工後のバッファの長さをループ期間として使用
            const loopDuration = track1Buffer.duration;

            // オフセットをループ長の範囲に収める
            let offset = offsetSeconds % loopDuration;
            if (offset < 0) {
                offset += loopDuration;
            }
            
            // トラック1: 加工後のバッファをループ再生（トラック1の加工後の範囲でループ）
            const source1 = this.audioContext.createBufferSource();
            this.gainNode1 = this.audioContext.createGain();
            this.analyser1 = this.audioContext.createAnalyser();
            this.analyser1.fftSize = 256;
            this.analyser1.smoothingTimeConstant = 0.8;
            
            source1.buffer = track1Buffer;
            source1.loop = true;
            source1.loopStart = 0;
            source1.loopEnd = loopDuration; // トラック1の加工後の範囲でループ
            
            source1.connect(this.gainNode1);
            // レベルメーター用（個別トラックの音量表示）
            this.gainNode1.connect(this.analyser1);
            
            // トラック2: 加工後のバッファをループ再生（トラック1と同じ範囲でループ）
            const source2 = this.audioContext.createBufferSource();
            this.gainNode2 = this.audioContext.createGain();
            this.analyser2 = this.audioContext.createAnalyser();
            this.analyser2.fftSize = 256;
            this.analyser2.smoothingTimeConstant = 0.8;
            
            source2.buffer = track2Buffer;
            source2.loop = true;
            source2.loopStart = 0;
            source2.loopEnd = loopDuration; // トラック1と同じ範囲でループ
            
            source2.connect(this.gainNode2);
            // レベルメーター用
            this.gainNode2.connect(this.analyser2);

            // マスターバス（2トラックをまとめて3バンド処理）
            this.masterBus = this.audioContext.createGain();
            
            // マスターバス用のアナライザー（スペクトラム表示用）
            this.masterAnalyser = this.audioContext.createAnalyser();
            this.masterAnalyser.fftSize = 2048; // より高解像度なスペクトラム分析
            this.masterAnalyser.smoothingTimeConstant = 0.8;

            // 各トラックの出力をマスターバスへ
            this.gainNode1.connect(this.masterBus);
            this.gainNode2.connect(this.masterBus);

            if (this.multibandCompProcessor &&
                this.multibandCompProcessor.getInputNode &&
                this.multibandCompProcessor.getOutputNode) {
                // masterBus -> MultiBand -> destination
                // 既存の接続を切断してから再接続（再生のたびに）
                const inputNode = this.multibandCompProcessor.getInputNode();
                const outputNode = this.multibandCompProcessor.getOutputNode();
                
                // 既存の接続を切断
                if (inputNode && inputNode.numberOfInputs > 0) {
                    // 入力ノードへの接続を切断（masterBusからの接続を解除）
                    // ただし、MultiBand内部の接続は維持
                }
                if (outputNode && outputNode.numberOfOutputs > 0) {
                    // 出力ノードからの接続を切断（destinationへの接続を解除）
                    outputNode.disconnect();
                }
                
                // 再接続
                this.masterBus.connect(inputNode);
                // MultiBand Compの出力（加工後の音）をアナライザーに接続
                outputNode.connect(this.masterAnalyser);
                outputNode.connect(this.audioContext.destination);

                // MultiBand Compプロセッサのノードは sourceNodes に含めない
                // （これらは再利用されるため、切断しない）
                this.sourceNodes = [
                    source1,
                    source2,
                    this.gainNode1,
                    this.gainNode2,
                    this.analyser1,
                    this.analyser2,
                    this.masterBus,
                    this.masterAnalyser
                ];
            } else {
                // マルチバンド未設定の場合は従来通り masterBus から直接出力
                this.masterBus.connect(this.masterAnalyser);
                this.masterBus.connect(this.audioContext.destination);
                this.sourceNodes = [
                    source1,
                    source2,
                    this.gainNode1,
                    this.gainNode2,
                    this.analyser1,
                    this.analyser2,
                    this.masterBus,
                    this.masterAnalyser
                ];
            }
            this.loopDuration = loopDuration;

            // 2トラックを同時に再生（オフセット位置から）
            const startAt = this.audioContext.currentTime;
            source1.start(startAt, offset);
            source2.start(startAt, offset);

            // 再生位置計算用の基準時刻（ループ位置 = currentTime - startTime）
            this.startTime = startAt - offset;
            this.isPlaying = true;
            return true;
        } catch (error) {
            console.error('再生エラー:', error);
            this.isPlaying = false;
            throw error;
        }
    }

    stopPreview() {
        this.sourceNodes.forEach(node => {
            try {
                if (node.stop) {
                    node.stop();
                }
                node.disconnect();
            } catch (e) {
                // 既に停止している場合など
            }
        });
        this.sourceNodes = [];
        
        // MultiBand Compプロセッサの出力ノードを切断
        // （入力ノードは masterBus が切断されることで自動的に切断される）
        if (this.multibandCompProcessor &&
            this.multibandCompProcessor.getOutputNode) {
            try {
                const outputNode = this.multibandCompProcessor.getOutputNode();
                if (outputNode) {
                    outputNode.disconnect();
                }
            } catch (e) {
                // 既に切断されている場合など
            }
        }
        
        this.gainNode1 = null;
        this.gainNode2 = null;
        this.analyser1 = null;
        this.analyser2 = null;
        this.masterBus = null;
        this.masterAnalyser = null;
        this.startTime = null;
        this.isPlaying = false;
    }
    
    // マスターバスの周波数スペクトラムデータを取得
    getFrequencyData() {
        if (!this.masterAnalyser) return null;
        
        const bufferLength = this.masterAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.masterAnalyser.getByteFrequencyData(dataArray);
        
        return {
            data: dataArray,
            sampleRate: this.audioContext.sampleRate,
            fftSize: this.masterAnalyser.fftSize
        };
    }

    getLevel(trackNumber) {
        const analyser = trackNumber === 1 ? this.analyser1 : this.analyser2;
        if (!analyser) return 0;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        // 平均音量を計算
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        
        // 0-100の範囲に正規化
        return average / 255;
    }

    setTrack1Mute(muted) {
        if (this.gainNode1) {
            this.gainNode1.gain.value = muted ? 0 : 1;
        }
    }

    setTrack2Mute(muted) {
        if (this.gainNode2) {
            this.gainNode2.gain.value = muted ? 0 : 1;
        }
    }

    getCurrentPlaybackTime() {
        if (!this.isPlaying || this.startTime === null || this.loopDuration === 0) {
            return null;
        }
        const elapsed = this.audioContext.currentTime - this.startTime;
        return elapsed % this.loopDuration;
    }
}

