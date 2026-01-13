// Analyzer UI部分（描画）
class AnalyzerUI {
    constructor(canvas, audioProcessor) {
        this.canvas = canvas;
        // willReadFrequently属性を設定してパフォーマンスを改善
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });
        this.audioProcessor = audioProcessor;
        this.animationFrameId = null;
        
        // ソノグラム用のバッファ（時間方向のデータを保持）
        // 循環バッファを使用（shift()のコストを削減）
        this.bufferSize = 512; // 保持する最大フレーム数
        this.spectrogramBuffer = new Array(this.bufferSize);
        this.bufferIndex = 0; // 循環バッファの現在位置
        this.bufferCount = 0; // 実際に格納されているデータ数
        
        // パフォーマンス最適化用のキャッシュ
        this.freqToYTable = null; // 周波数→Y座標変換テーブル
        this.colorTable = null; // 強度→色変換テーブル
        this.lastCanvasHeight = 0;
        this.lastCanvasWidth = 0;
        
        // インクリメンタル描画用
        this.lastDrawnCount = 0;
    }
    
    start() {
        if (this.animationFrameId) return;
        // バッファをクリア
        this.spectrogramBuffer = new Array(this.bufferSize);
        this.bufferIndex = 0;
        this.bufferCount = 0;
        this.lastDrawnCount = 0;
        // キャッシュをクリア
        this.freqToYTable = null;
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
        this.spectrogramBuffer = new Array(this.bufferSize);
        this.bufferIndex = 0;
        this.bufferCount = 0;
        this.lastDrawnCount = 0;
        // キャッシュをクリア
        this.freqToYTable = null;
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
    
    // 新しい周波数データをバッファに追加（循環バッファを使用）
    addSpectrumColumn(dataArray) {
        // 新しい列をコピー
        const newColumn = new Uint8Array(dataArray.length);
        for (let i = 0; i < dataArray.length; i++) {
            newColumn[i] = dataArray[i];
        }
        
        // 循環バッファに追加（shift()のコストを削減）
        this.spectrogramBuffer[this.bufferIndex] = newColumn;
        this.bufferIndex = (this.bufferIndex + 1) % this.bufferSize;
        
        if (this.bufferCount < this.bufferSize) {
            this.bufferCount++;
        }
    }
    
    // ソノグラムを描画（最適化版：インクリメンタル描画）
    drawSpectrogram() {
        const width = this.canvas.width = this.canvas.offsetWidth;
        const height = this.canvas.height = this.canvas.offsetHeight;
        const ctx = this.ctx;
        
        if (this.bufferCount === 0) {
            // 背景をクリア
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, width, height);
            return;
        }
        
        // キャンバスサイズが変わった場合は全再描画
        if (width !== this.lastCanvasWidth || height !== this.lastCanvasHeight) {
            this.lastCanvasWidth = width;
            this.lastCanvasHeight = height;
            this.freqToYTable = null;
            this.colorTable = null;
            this.lastDrawnCount = 0;
        }
        
        // 変換テーブルを事前計算（初回またはサイズ変更時のみ）
        if (!this.freqToYTable || this.freqToYTable.length !== height) {
            const numFrequencies = this.spectrogramBuffer[0] ? this.spectrogramBuffer[0].length : 1024;
            this.freqToYTable = new Int32Array(height);
            const minFreq = 0;
            const maxFreq = numFrequencies - 1;
            for (let y = 0; y < height; y++) {
                const normalizedY = 1 - (y / height);
                const freqIndex = this.logScaleToFreq(normalizedY, minFreq, maxFreq);
                this.freqToYTable[y] = Math.max(0, Math.min(numFrequencies - 1, Math.floor(freqIndex)));
            }
        }
        
        // 色変換テーブルを事前計算（初回のみ）
        if (!this.colorTable) {
            this.colorTable = new Array(256);
            for (let i = 0; i < 256; i++) {
                this.colorTable[i] = this.intensityToColor(i / 255.0);
            }
        }
        
        // 新しい列の数を計算
        const newColumns = Math.min(5, this.bufferCount - this.lastDrawnCount);
        
        if (newColumns > 0 && this.lastDrawnCount > 0) {
            // インクリメンタル描画：既存の画像を左にシフト
            const shiftWidth = width - newColumns;
            if (shiftWidth > 0) {
                const imageData = ctx.getImageData(newColumns, 0, shiftWidth, height);
                ctx.putImageData(imageData, 0, 0);
            }
        } else if (this.lastDrawnCount === 0) {
            // 初回は背景をクリア
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, width, height);
        }
        
        // 新しい列だけを右端に描画
        const numFrequencies = this.spectrogramBuffer[0] ? this.spectrogramBuffer[0].length : 1024;
        const numTimeFrames = Math.min(this.bufferCount, width);
        const startX = Math.max(0, width - numTimeFrames);
        const columnsToDraw = Math.min(newColumns > 0 ? newColumns : numTimeFrames, numTimeFrames);
        
        if (columnsToDraw > 0) {
            const imageData = ctx.createImageData(columnsToDraw, height);
            const data = imageData.data;
            
            for (let t = 0; t < columnsToDraw; t++) {
                // 循環バッファからデータを取得
                let bufferPos;
                if (newColumns > 0) {
                    // 新しい列を描画
                    bufferPos = (this.bufferIndex - newColumns + t + this.bufferSize) % this.bufferSize;
                } else {
                    // 全再描画
                    bufferPos = (this.bufferIndex - numTimeFrames + t + this.bufferSize) % this.bufferSize;
                }
                
                const column = this.spectrogramBuffer[bufferPos];
                if (!column) continue;
                
                for (let y = 0; y < height; y++) {
                    const f = this.freqToYTable[y];
                    if (f < 0 || f >= numFrequencies) continue;
                    
                    const intensity = column[f];
                    const color = this.colorTable[intensity];
                    
                    const pixelIndex = (y * columnsToDraw + t) * 4;
                    if (pixelIndex >= 0 && pixelIndex < data.length - 3) {
                        data[pixelIndex] = color.r;
                        data[pixelIndex + 1] = color.g;
                        data[pixelIndex + 2] = color.b;
                        data[pixelIndex + 3] = 255;
                    }
                }
            }
            
            const drawX = newColumns > 0 ? width - newColumns : startX;
            ctx.putImageData(imageData, drawX, 0);
        }
        
        this.lastDrawnCount = this.bufferCount;
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
