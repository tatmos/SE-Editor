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
        // フェードカーブ設定（デフォルトはログフェード）
        this.fadeSettingsTrack1 = {
            mode: 'log',
            controlX: 0.25,
            controlY: 0.1
        };
        this.fadeSettingsTrack2 = {
            mode: 'log',
            controlX: 0.25,
            controlY: 0.9  // フェードアウトは反転（上側に配置）
        };
        
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
        const fadeCanvas1 = document.getElementById('fade-ui-track1');
        const fadeCanvas2 = document.getElementById('fade-ui-track2');
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
        this.fadeUIController = new FadeUIController(this, fadeCanvas1, fadeCanvas2);
        
        // Analyzer、MultiBand Comp、Spatial Designを初期化
        const analyzerCanvas = document.getElementById('analyzer-canvas');
        const spatialCanvas = document.getElementById('spatial-canvas');
        
        // 注意: audioPlayerは後で設定されるため、初期化は後で行う
        this.analyzer = null;
        this.multibandComp = null;
        this.spatialDesign = null;
        
        if (analyzerCanvas) {
            // AnalyzerはaudioPlayerが作成された後に初期化
        }
        
        if (spatialCanvas) {
            // SpatialDesignはaudioPlayerが作成された後に初期化
        }
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
        
        // どちらかのバッファがない場合は処理をスキップ
        if (!useRangeBuffer1 && !useRangeBuffer2) return;
        
        // トラック1の加工後のバッファを生成（元波形1を使用）
        if (useRangeBuffer1) {
            this.track1Buffer = this.audioProcessor.track1Processor.createSaveBuffer(
                useRangeBuffer1, 
                this.overlapRate,
                this.fadeSettingsTrack1
            );
        } else {
            // 元波形1がない場合は空のバッファを作成
            const sampleRate = this.audioContext.sampleRate;
            const numChannels = useRangeBuffer2 ? useRangeBuffer2.numberOfChannels : 2;
            const duration = useRangeBuffer2 ? useRangeBuffer2.duration : 1.0;
            this.track1Buffer = this.audioContext.createBuffer(numChannels, Math.floor(duration * sampleRate), sampleRate);
        }
        
        // トラック2の加工後のバッファを生成（元波形2を使用、トラック1と同じサイズにする）
        if (useRangeBuffer2) {
            this.track2Buffer = this.audioProcessor.track2Processor.createSaveBuffer(
                useRangeBuffer2, 
                this.overlapRate,
                this.track1Buffer.duration,
                this.fadeSettingsTrack2
            );
        } else {
            // 元波形2がない場合は空のバッファを作成
            const sampleRate = this.audioContext.sampleRate;
            const numChannels = useRangeBuffer1 ? useRangeBuffer1.numberOfChannels : 2;
            const duration = this.track1Buffer.duration;
            this.track2Buffer = this.audioContext.createBuffer(numChannels, Math.floor(duration * sampleRate), sampleRate);
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
        this.waveformRenderer.render(this.track1Buffer, this.track2Buffer, currentTime);
        if (this.fadeUIController) {
            this.fadeUIController.render();
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
        if (this.analyzer) {
            this.analyzer.stop();
        }
    }
    
    // Analyzer、MultiBand Comp、Spatial Designを初期化
    initializeEffects() {
        if (!this.audioPlayer || !this.audioContext) return;
        
        const analyzerCanvas = document.getElementById('analyzer-canvas');
        const spatialCanvas = document.getElementById('spatial-canvas');
        
        // Analyzerを初期化
        if (analyzerCanvas && !this.analyzer) {
            this.analyzer = new Analyzer(analyzerCanvas, this.audioPlayer);
            this.analyzer.setupAnalyser();
        }
        
        // MultiBand Compを初期化
        if (!this.multibandComp) {
            this.multibandComp = new MultiBandComp(this.audioContext, this.audioPlayer);
        }
        
        // Spatial Designを初期化
        if (spatialCanvas && !this.spatialDesign) {
            this.spatialDesign = new SpatialDesign(spatialCanvas, this.audioPlayer);
        }
    }

}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    new LoopMaker();
});

