// Analyzer UI部分（描画）
class AnalyzerUI {
    constructor(canvas, audioProcessor) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.audioProcessor = audioProcessor;
        this.animationFrameId = null;
        
        // ソノグラム用のバッファ（時間方向のデータを保持）
        this.spectrogramBuffer = [];
        this.maxHistoryLength = 512; // 保持する最大フレーム数
        this.sampleInterval = 0; // サンプリング間隔（フレーム数）
        this.sampleCounter = 0;
    }
    
    start() {
        if (this.animationFrameId) return;
        // バッファをクリア
        this.spectrogramBuffer = [];
        this.sampleCounter = 0;
        this.animate();
    }
    
    stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        // キャンバスをクリア
        const width = this.canvas.width = this.canvas.offsetWidth;
        const height = this.canvas.height = this.canvas.offsetHeight;
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, width, height);
        // バッファもクリア
        this.spectrogramBuffer = [];
        this.sampleCounter = 0;
    }
    
    animate() {
        if (!this.audioProcessor) {
            this.animationFrameId = requestAnimationFrame(() => this.animate());
            return;
        }
        
        const dataArray = this.audioProcessor.getFrequencyData();
        if (dataArray) {
            // スクロール速度を上げるため、毎フレーム複数回データを追加
            // 5倍の速度にするため、1フレームあたり5回追加
            for (let i = 0; i < 5; i++) {
                this.addSpectrumColumn(dataArray);
            }
            this.drawSpectrogram();
        }
        
        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }
    
    // 新しい周波数データをバッファに追加
    addSpectrumColumn(dataArray) {
        // 新しい列をコピー
        const newColumn = new Uint8Array(dataArray.length);
        for (let i = 0; i < dataArray.length; i++) {
            newColumn[i] = dataArray[i];
        }
        
        // 右端に追加
        this.spectrogramBuffer.push(newColumn);
        
        // 最大長を超えたら古いデータを削除
        if (this.spectrogramBuffer.length > this.maxHistoryLength) {
            this.spectrogramBuffer.shift();
        }
    }
    
    // ソノグラムを描画
    drawSpectrogram() {
        const width = this.canvas.width = this.canvas.offsetWidth;
        const height = this.canvas.height = this.canvas.offsetHeight;
        const ctx = this.ctx;
        
        // 背景をクリア
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
        
        if (this.spectrogramBuffer.length === 0) return;
        
        const numFrequencies = this.spectrogramBuffer[0].length;
        const numTimeFrames = Math.min(this.spectrogramBuffer.length, width);
        
        // 周波数軸を対数スケールで表示
        // 低周波を下、高周波を上に表示
        const minFreq = 0;
        const maxFreq = numFrequencies - 1;
        
        // ピクセル単位で描画
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;
        
        // 各時間フレームを描画（右端が最新）
        for (let t = 0; t < numTimeFrames; t++) {
            const column = this.spectrogramBuffer[this.spectrogramBuffer.length - numTimeFrames + t];
            if (!column) continue;
            
            // 時間位置（右端が最新）
            const x = width - numTimeFrames + t;
            if (x < 0 || x >= width) continue;
            
            // 各周波数ビンを描画（対数スケールでマッピング）
            for (let y = 0; y < height; y++) {
                // 縦位置を周波数に変換（対数スケール）
                const normalizedY = 1 - (y / height);
                const freqIndex = this.logScaleToFreq(normalizedY, minFreq, maxFreq);
                const f = Math.floor(freqIndex);
                
                if (f < 0 || f >= numFrequencies) continue;
                
                // 強度を取得
                const intensity = column[f] / 255.0;
                
                // ヒートマップ風の色付け
                const color = this.intensityToColor(intensity);
                
                // ピクセルを設定
                const pixelIndex = (y * width + x) * 4;
                if (pixelIndex >= 0 && pixelIndex < data.length - 3) {
                    data[pixelIndex] = color.r;     // R
                    data[pixelIndex + 1] = color.g; // G
                    data[pixelIndex + 2] = color.b; // B
                    data[pixelIndex + 3] = 255;     // A
                }
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
    }
    
    // 対数スケール（0-1）を周波数インデックスに変換
    logScaleToFreq(logScale, minFreq, maxFreq) {
        const logMin = Math.log10(minFreq + 1);
        const logMax = Math.log10(maxFreq + 1);
        const logFreq = logMin + logScale * (logMax - logMin);
        return Math.pow(10, logFreq) - 1;
    }
    
    // 周波数を対数スケールに変換（0-1の範囲）
    freqToLogScale(freq, minFreq, maxFreq) {
        if (freq <= minFreq) return 0;
        if (freq >= maxFreq) return 1;
        
        // 対数スケール変換
        const logMin = Math.log10(minFreq + 1);
        const logMax = Math.log10(maxFreq + 1);
        const logFreq = Math.log10(freq + 1);
        
        return (logFreq - logMin) / (logMax - logMin);
    }
    
    // 強度（0-1）を色に変換（ヒートマップ風）
    intensityToColor(intensity) {
        // 強度を0-1の範囲に正規化
        const clamped = Math.max(0, Math.min(1, intensity));
        
        // ヒートマップ風の色付け（青→緑→黄→赤）
        let r, g, b;
        
        if (clamped < 0.25) {
            // 青から緑
            const t = clamped / 0.25;
            r = 0;
            g = Math.floor(t * 255);
            b = Math.floor((1 - t) * 255);
        } else if (clamped < 0.5) {
            // 緑から黄
            const t = (clamped - 0.25) / 0.25;
            r = Math.floor(t * 255);
            g = 255;
            b = 0;
        } else if (clamped < 0.75) {
            // 黄からオレンジ
            const t = (clamped - 0.5) / 0.25;
            r = 255;
            g = Math.floor((1 - t) * 255);
            b = 0;
        } else {
            // オレンジから赤
            const t = (clamped - 0.75) / 0.25;
            r = 255;
            g = Math.floor((1 - t) * 128);
            b = 0;
        }
        
        return { r, g, b };
    }
}
