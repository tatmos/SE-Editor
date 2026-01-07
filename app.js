// LoopMaker - ループ波形エディタ
class LoopMaker {
    constructor() {
        this.audioContext = null;
        this.originalBuffer = null; // 元波形のバッファ
        this.track1Buffer = null; // トラック1の加工後のバッファ
        this.track2Buffer = null; // トラック2の加工後のバッファ
        this.mixedBuffer = null; // トラック1と2をミックスしたバッファ
        this.audioProcessor = null;
        this.audioPlayer = null;
        this.waveformRenderer = null;
        this.originalWaveformViewer = null;
        this.overlapRate = 0; // オーバーラップ率（0-50%）
        this.animationFrameId = null;
        this.useRangeStart = 0; // 利用範囲の開始位置
        this.useRangeEnd = 0; // 利用範囲の終了位置
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
        this.overlapRateController = new OverlapRateController(this);
    }

    initializeElements() {
        const originalCanvas = document.getElementById('original-waveform');
        const originalRuler = document.getElementById('ruler-original');
        const canvas1 = document.getElementById('waveform-track1');
        const canvas2 = document.getElementById('waveform-track2');
        const fadeCanvas1 = document.getElementById('fade-ui-track1');
        const fadeCanvas2 = document.getElementById('fade-ui-track2');
        const ruler1 = document.getElementById('ruler-track1');
        const ruler2 = document.getElementById('ruler-track2');
        this.levelMeter1 = document.getElementById('level-meter-track1');
        this.levelMeter2 = document.getElementById('level-meter-track2');
        
        this.originalWaveformViewer = new OriginalWaveformViewer(originalCanvas, originalRuler);
        this.originalWaveformViewer.onRangeChange = (startTime, endTime) => {
            this.useRangeStart = startTime;
            this.useRangeEnd = endTime;
            this.updateBuffers();
            this.drawWaveforms();
        };
        
        this.waveformRenderer = new WaveformRenderer(canvas1, canvas2, ruler1, ruler2);
        this.fadeUIController = new FadeUIController(this, fadeCanvas1, fadeCanvas2);
    }

    updateBuffers() {
        if (!this.originalBuffer || !this.audioProcessor) return;
        
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
        
        // 元波形から利用範囲を抽出
        const useRangeBuffer = this.audioProcessor.extractRange(
            this.originalBuffer,
            this.useRangeStart,
            this.useRangeEnd
        );
        
        // トラック1の加工後のバッファを生成
        this.track1Buffer = this.audioProcessor.track1Processor.createSaveBuffer(
            useRangeBuffer, 
            this.overlapRate,
            this.fadeSettingsTrack1
        );
        
        // トラック2の加工後のバッファを生成（トラック1と同じサイズにする）
        this.track2Buffer = this.audioProcessor.track2Processor.createSaveBuffer(
            useRangeBuffer, 
            this.overlapRate,
            this.track1Buffer.duration,
            this.fadeSettingsTrack2
        );
        
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
    }

}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    new LoopMaker();
});

