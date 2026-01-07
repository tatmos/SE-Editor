// LoopMaker - ループ波形エディタ
class LoopMaker {
    constructor() {
        this.audioContext = null;
        this.originalBuffer1 = null; // 元波形1のバッファ
        this.originalBuffer2 = null; // 元波形2のバッファ
        this.track1Buffer = null; // トラック1の加工後のバッファ
        this.track2Buffer = null; // トラック2の加工後のバッファ
        this.mixedBuffer = null; // トラック1と2をミックスしたバッファ
        this.audioProcessor = null;
        this.audioPlayer = null;
        this.waveformRenderer = null;
        this.originalWaveformViewer1 = null;
        this.originalWaveformViewer2 = null;
        this.animationFrameId = null;
        this.useRangeStart1 = 0; // 元波形1の利用範囲の開始位置
        this.useRangeEnd1 = 0; // 元波形1の利用範囲の終了位置
        this.useRangeStart2 = 0; // 元波形2の利用範囲の開始位置
        this.useRangeEnd2 = 0; // 元波形2の利用範囲の終了位置
        
        this.initializeElements();
        this.uiController = new UIController(this);
    }

    initializeElements() {
        const originalCanvas1 = document.getElementById('original-waveform-1');
        const originalRuler1 = document.getElementById('ruler-original-1');
        const originalCanvas2 = document.getElementById('original-waveform-2');
        const originalRuler2 = document.getElementById('ruler-original-2');
        const canvas1 = document.getElementById('waveform-track1');
        const canvas2 = document.getElementById('waveform-track2');
        const ruler1 = document.getElementById('ruler-track1');
        const ruler2 = document.getElementById('ruler-track2');
        this.levelMeter1 = document.getElementById('level-meter-track1');
        this.levelMeter2 = document.getElementById('level-meter-track2');
        
        this.originalWaveformViewer1 = new OriginalWaveformViewer(originalCanvas1, originalRuler1);
        this.originalWaveformViewer1.onRangeChange = (startTime, endTime) => {
            this.useRangeStart1 = startTime;
            this.useRangeEnd1 = endTime;
            this.updateBuffers();
            this.drawWaveforms();
        };
        
        this.originalWaveformViewer2 = new OriginalWaveformViewer(originalCanvas2, originalRuler2);
        this.originalWaveformViewer2.onRangeChange = (startTime, endTime) => {
            this.useRangeStart2 = startTime;
            this.useRangeEnd2 = endTime;
            this.updateBuffers();
            this.drawWaveforms();
        };
        
        this.waveformRenderer = new WaveformRenderer(canvas1, canvas2, ruler1, ruler2);
        
        // リージョンコントローラーを初期化
        this.regionController1 = new RegionController(this, canvas1, 1);
        this.regionController2 = new RegionController(this, canvas2, 2);
        
        // トラックの表示範囲（同期用）
        this.trackDisplayDuration = 0;
        
        // エフェクトのUIとProcessorを初期化（audioContextとaudioProcessorは後で設定）
        this.pitchTransposeUI = null;
        this.pitchTransposeProcessor = null;
        this.analyzerUI = null;
        this.analyzerProcessor = null;
        this.multibandCompUI = null;
        this.multibandCompProcessor = null;
        this.spatialDesignUI = null;
        this.spatialDesignProcessor = null;
    }

    updateBuffers() {
        if (!this.audioProcessor) return;
        
        // 再生中の場合、現在の再生位置を保持
        const wasPlaying = this.audioPlayer && this.audioPlayer.isPlaying;
        let currentPlaybackTime = null;
        if (wasPlaying) {
            currentPlaybackTime = this.audioPlayer.getCurrentPlaybackTime();
            if (currentPlaybackTime !== null) {
                // 新しいバッファの長さに合わせてクリップ
                const oldDuration = this.track1Buffer ? this.track1Buffer.duration : 0;
            }
        }
        
        // 元波形1と元波形2の選択範囲の長さを計算
        const range1Duration = this.originalBuffer1 ? (this.useRangeEnd1 - this.useRangeStart1) : 0;
        const range2Duration = this.originalBuffer2 ? (this.useRangeEnd2 - this.useRangeStart2) : 0;
        
        // 長い方を基準にする
        const baseDuration = Math.max(range1Duration, range2Duration);
        
        // どちらかのバッファがない場合は処理をスキップ
        if (baseDuration <= 0) return;
        
        // トラックの表示範囲を同期（長い方を基準）
        this.trackDisplayDuration = baseDuration;
        
        // 元波形1から利用範囲を抽出（トラック1用）
        let useRangeBuffer1 = null;
        if (this.originalBuffer1) {
            useRangeBuffer1 = this.audioProcessor.extractRange(
                this.originalBuffer1,
                this.useRangeStart1,
                this.useRangeEnd1
            );
        }
        
        // 元波形2から利用範囲を抽出（トラック2用）
        let useRangeBuffer2 = null;
        if (this.originalBuffer2) {
            useRangeBuffer2 = this.audioProcessor.extractRange(
                this.originalBuffer2,
                this.useRangeStart2,
                this.useRangeEnd2
            );
        }
        
        // トラック1の加工後のバッファを生成（元波形1を使用、baseDurationに合わせる）
        if (useRangeBuffer1) {
            // ピッチシフトを適用
            let processedBuffer = useRangeBuffer1;
            if (this.pitchTransposeProcessor) {
                processedBuffer = this.pitchTransposeProcessor.applyPitchShift(processedBuffer, 1);
            }
            
            this.track1Buffer = this.audioProcessor.track1Processor.createSaveBuffer(
                processedBuffer
            );
            
            // baseDurationに合わせて調整（必要に応じて）
            if (this.track1Buffer.duration < baseDuration) {
                // バッファを延長（無音で埋める）
                const extendedBuffer = this.extendBuffer(this.track1Buffer, baseDuration);
                this.track1Buffer = extendedBuffer;
            } else if (this.track1Buffer.duration > baseDuration) {
                // バッファを切り詰める
                const trimmedBuffer = this.trimBuffer(this.track1Buffer, baseDuration);
                this.track1Buffer = trimmedBuffer;
            }
        } else {
            // 元波形1がない場合は空のバッファを作成（ステレオに統一）
            const sampleRate = this.audioContext.sampleRate;
            this.track1Buffer = this.audioContext.createBuffer(2, Math.floor(baseDuration * sampleRate), sampleRate);
        }
        
        // トラック2の加工後のバッファを生成（元波形2を使用、baseDurationに合わせる）
        if (useRangeBuffer2) {
            // ピッチシフトを適用
            let processedBuffer = useRangeBuffer2;
            if (this.pitchTransposeProcessor) {
                processedBuffer = this.pitchTransposeProcessor.applyPitchShift(processedBuffer, 2);
            }
            
            this.track2Buffer = this.audioProcessor.track2Processor.createSaveBuffer(
                processedBuffer, 
                baseDuration
            );
            
            // baseDurationに合わせて調整（必要に応じて）
            if (this.track2Buffer.duration < baseDuration) {
                // バッファを延長（無音で埋める）
                const extendedBuffer = this.extendBuffer(this.track2Buffer, baseDuration);
                this.track2Buffer = extendedBuffer;
            } else if (this.track2Buffer.duration > baseDuration) {
                // バッファを切り詰める
                const trimmedBuffer = this.trimBuffer(this.track2Buffer, baseDuration);
                this.track2Buffer = trimmedBuffer;
            }
        } else {
            // 元波形2がない場合は空のバッファを作成（ステレオに統一）
            const sampleRate = this.audioContext.sampleRate;
            this.track2Buffer = this.audioContext.createBuffer(2, Math.floor(baseDuration * sampleRate), sampleRate);
        }
        
        // トラック1と2をミックスしたバッファを生成
        this.mixedBuffer = this.audioProcessor.mixBuffers(this.track1Buffer, this.track2Buffer);
        
        // 再生中だった場合、新しいバッファで再生を再開
        if (wasPlaying && this.audioPlayer && this.track1Buffer && this.track2Buffer) {
            const newDuration = this.track1Buffer.duration;
            if (newDuration > 0) {
                // 新しいバッファの長さに合わせて再生位置をクリップ
                let seekTime = currentPlaybackTime !== null ? currentPlaybackTime : 0;
                seekTime = Math.max(0, Math.min(newDuration, seekTime));
                this.audioPlayer.stopPreview();
                this.audioPlayer.playPreviewWithBuffers(this.track1Buffer, this.track2Buffer, seekTime);
            }
        }
    }
    
    // バッファを延長（無音で埋める）
    extendBuffer(audioBuffer, targetDuration) {
        const sampleRate = this.audioContext.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const currentLength = audioBuffer.length;
        const targetLength = Math.floor(targetDuration * sampleRate);
        
        if (targetLength <= currentLength) {
            return audioBuffer;
        }
        
        const extendedBuffer = this.audioContext.createBuffer(numChannels, targetLength, sampleRate);
        
        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = extendedBuffer.getChannelData(channel);
            
            // 既存のデータをコピー
            for (let i = 0; i < currentLength; i++) {
                outputData[i] = inputData[i];
            }
            
            // 残りを無音で埋める（既に0で初期化されている）
        }
        
        return extendedBuffer;
    }
    
    // バッファを切り詰める
    trimBuffer(audioBuffer, targetDuration) {
        const sampleRate = this.audioContext.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const targetLength = Math.floor(targetDuration * sampleRate);
        
        if (targetLength >= audioBuffer.length) {
            return audioBuffer;
        }
        
        const trimmedBuffer = this.audioContext.createBuffer(numChannels, targetLength, sampleRate);
        
        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = trimmedBuffer.getChannelData(channel);
            
            // 指定された長さまでコピー
            for (let i = 0; i < targetLength; i++) {
                outputData[i] = inputData[i];
            }
        }
        
        return trimmedBuffer;
    }

    // 波形上クリックによるシーク
    seekTo(timeInSeconds) {
        if (!this.audioPlayer || !this.track1Buffer || !this.track2Buffer) return;

        const duration = this.track1Buffer.duration;
        if (duration <= 0) return;

        // ループ範囲内にクリップ
        let targetTime = Math.max(0, Math.min(duration, timeInSeconds));

        // 再生中のみシーク（要望に合わせて）
        if (this.audioPlayer.isPlaying) {
            this.audioPlayer.stopPreview();
            this.audioPlayer.playPreviewWithBuffers(this.track1Buffer, this.track2Buffer, targetTime);
        }
    }

    drawWaveforms() {
        if (!this.track1Buffer || !this.track2Buffer || !this.waveformRenderer) return;
        const currentTime = this.audioPlayer ? this.audioPlayer.getCurrentPlaybackTime() : null;
        // トラック1とトラック2の表示範囲を同期（trackDisplayDurationを使用）
        this.waveformRenderer.render(this.track1Buffer, this.track2Buffer, currentTime, this.trackDisplayDuration);
        // リージョンを描画
        if (this.regionController1) {
            this.regionController1.render();
        }
        if (this.regionController2) {
            this.regionController2.render();
        }
    }

    startPlaybackAnimation() {
        const animate = () => {
            if (this.audioPlayer && this.audioPlayer.isPlaying) {
                this.drawWaveforms();
                this.updateLevelMeters();
                this.animationFrameId = requestAnimationFrame(animate);
            } else {
                this.animationFrameId = null;
                this.resetLevelMeters();
            }
        };
        if (this.animationFrameId === null) {
            this.animationFrameId = requestAnimationFrame(animate);
        }
    }

    updateLevelMeters() {
        if (!this.audioPlayer) return;

        const level1 = this.audioPlayer.getLevel(1);
        const level2 = this.audioPlayer.getLevel(2);

        if (this.levelMeter1) {
            const bar1 = this.levelMeter1.querySelector('.level-bar');
            if (bar1) {
                bar1.style.height = (level1 * 100) + '%';
            }
        }

        if (this.levelMeter2) {
            const bar2 = this.levelMeter2.querySelector('.level-bar');
            if (bar2) {
                bar2.style.height = (level2 * 100) + '%';
            }
        }
    }

    resetLevelMeters() {
        if (this.levelMeter1) {
            const bar1 = this.levelMeter1.querySelector('.level-bar');
            if (bar1) {
                bar1.style.height = '0%';
            }
        }

        if (this.levelMeter2) {
            const bar2 = this.levelMeter2.querySelector('.level-bar');
            if (bar2) {
                bar2.style.height = '0%';
            }
        }
    }

    stopPlaybackAnimation() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        // 再生位置ラインを消すために再描画
        this.drawWaveforms();
        
        // Analyzerを停止
        if (this.analyzerUI) {
            this.analyzerUI.stop();
        }
    }
    
    // エフェクトのUIとProcessorを初期化
    initializeEffects() {
        if (!this.audioContext || !this.audioProcessor) return;
        
        // ピッチトランスポーズ
        if (!this.pitchTransposeUI) {
            this.pitchTransposeProcessor = new PitchTransposeProcessor(this.audioContext);
            this.pitchTransposeUI = new PitchTransposeUI(this.pitchTransposeProcessor);
        }
        
        // Analyzer
        const analyzerCanvas = document.getElementById('analyzer-canvas');
        if (analyzerCanvas && !this.analyzerUI) {
            this.analyzerProcessor = new AnalyzerProcessor(this.audioContext);
            this.analyzerUI = new AnalyzerUI(analyzerCanvas, this.analyzerProcessor);
        }
        
        // MultiBand Comp
        if (!this.multibandCompUI) {
            this.multibandCompProcessor = new MultiBandCompProcessor(this.audioContext);
            this.multibandCompUI = new MultiBandCompUI(this.multibandCompProcessor);
        }
        
        // Spatial Design
        const spatialCanvas = document.getElementById('spatial-canvas');
        if (spatialCanvas && !this.spatialDesignUI) {
            this.spatialDesignProcessor = new SpatialDesignProcessor(this.audioContext);
            this.spatialDesignUI = new SpatialDesignUI(spatialCanvas, this.spatialDesignProcessor);
        }
    }

}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    new LoopMaker();
});

