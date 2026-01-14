// スペクトラムアナライザー描画クラス
class SpectrumAnalyzer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        
        // キャンバスのサイズを調整
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }
    
    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.width = rect.width;
        this.height = rect.height;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
    }
    
    /**
     * 周波数スペクトラムを描画
     * @param {Uint8Array} frequencyData - 周波数データ（0-255）
     * @param {number} sampleRate - サンプルレート
     * @param {number} fftSize - FFTサイズ
     */
    draw(frequencyData, sampleRate, fftSize) {
        if (!frequencyData || frequencyData.length === 0) {
            this.clear();
            return;
        }
        
        const ctx = this.ctx;
        const width = this.width;
        const height = this.height;
        
        // 背景をクリア
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
        
        // グリッドを描画
        this.drawGrid(ctx, width, height);
        
        // 周波数軸のラベルを描画
        this.drawFrequencyLabels(ctx, width, height, sampleRate, fftSize);
        
        // スペクトラムを描画
        const barWidth = width / frequencyData.length;
        const maxFreq = sampleRate / 2; // ナイキスト周波数
        
        ctx.fillStyle = '#667eea';
        ctx.strokeStyle = '#5568d3';
        ctx.lineWidth = 1;
        
        for (let i = 0; i < frequencyData.length; i++) {
            const value = frequencyData[i];
            const barHeight = (value / 255) * height * 0.9; // 90%の高さまで使用
            
            const x = i * barWidth;
            const y = height - barHeight;
            
            // バーを描画
            ctx.fillRect(x, y, barWidth - 1, barHeight);
            
            // 上部に線を描画（より視覚的に）
            if (barHeight > 2) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + barWidth - 1, y);
                ctx.stroke();
            }
        }
        
        // 対数スケールでより見やすくする（オプション）
        // 低周波数域を強調表示
        this.drawLogScale(ctx, frequencyData, width, height, sampleRate, fftSize);
    }
    
    /**
     * グリッドを描画
     */
    drawGrid(ctx, width, height) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        
        // 水平線（dBレベル）
        const dbLevels = [0, -6, -12, -18, -24, -30, -36, -42, -48, -54, -60];
        dbLevels.forEach((db, index) => {
            const y = (index / (dbLevels.length - 1)) * height * 0.9;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        });
        
        // 垂直線（周波数）
        const freqLines = 10;
        for (let i = 0; i <= freqLines; i++) {
            const x = (i / freqLines) * width;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
    }
    
    /**
     * 周波数ラベルを描画
     */
    drawFrequencyLabels(ctx, width, height, sampleRate, fftSize) {
        ctx.fillStyle = '#999';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        // 周波数ラベル（Hz）
        const freqLabels = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
        const maxFreq = sampleRate / 2;
        
        freqLabels.forEach(freq => {
            if (freq <= maxFreq) {
                // 周波数を配列インデックスに変換（線形スケール）
                const index = (freq / maxFreq) * (fftSize / 2);
                const x = (index / (fftSize / 2)) * width;
                
                if (x >= 0 && x <= width) {
                    ctx.fillText(this.formatFrequency(freq), x, height - 20);
                }
            }
        });
        
        // dBレベルラベル
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const dbLevels = [0, -12, -24, -36, -48, -60];
        dbLevels.forEach((db, index) => {
            const y = (index / (dbLevels.length - 1)) * height * 0.9;
            ctx.fillText(db + 'dB', width - 5, y);
        });
    }
    
    /**
     * 対数スケールでスペクトラムを描画（低周波数域を強調）
     */
    drawLogScale(ctx, frequencyData, width, height, sampleRate, fftSize) {
        // 対数スケール用のオーバーレイ（オプション）
        // ここでは実装を簡略化
    }
    
    /**
     * 周波数をフォーマット（Hz, kHz）
     */
    formatFrequency(freq) {
        if (freq >= 1000) {
            return (freq / 1000).toFixed(1) + 'k';
        }
        return freq.toString();
    }
    
    /**
     * キャンバスをクリア
     */
    clear() {
        const ctx = this.ctx;
        const width = this.width;
        const height = this.height;
        
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
        
        // メッセージを表示
        ctx.fillStyle = '#666';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('再生中にスペクトラムが表示されます', width / 2, height / 2);
    }
}
