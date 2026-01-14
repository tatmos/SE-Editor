// スペクトラムアナライザー描画クラス
class SpectrumAnalyzer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        
        // 表示モード: 'spectrum' または 'sonogram'
        this.mode = 'spectrum';
        
        // ソノグラム用のデータバッファ（時間×周波数の2次元配列）
        this.sonogramData = [];
        this.sonogramColumnIndex = 0; // 現在描画している列のインデックス
        this.sonogramMaxColumns = 0; // キャンバス幅に応じた最大列数
        
        // ソノグラム更新頻度（フレームごと）
        this.sonogramUpdateRate = 1; // デフォルトは毎フレーム
        this.sonogramUpdateCounter = 0; // 更新カウンター
        
        // キャンバスのサイズを調整
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // モード切り替えボタンのイベントリスナーを設定
        this.setupModeButtons();
        
        // 更新頻度スライダーのイベントリスナーを設定
        this.setupUpdateRateSlider();
    }
    
    setupModeButtons() {
        const spectrumBtn = document.getElementById('spectrum-mode-spectrum');
        const sonogramBtn = document.getElementById('spectrum-mode-sonogram');
        
        if (spectrumBtn) {
            spectrumBtn.addEventListener('click', () => {
                this.setMode('spectrum');
            });
        }
        
        if (sonogramBtn) {
            sonogramBtn.addEventListener('click', () => {
                this.setMode('sonogram');
            });
        }
    }
    
    setupUpdateRateSlider() {
        const slider = document.getElementById('sonogram-update-rate');
        const valueDisplay = document.getElementById('sonogram-update-rate-value');
        const control = document.getElementById('sonogram-update-control');
        
        if (slider && valueDisplay) {
            slider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.sonogramUpdateRate = value;
                valueDisplay.textContent = value;
            });
        }
    }
    
    setMode(mode) {
        this.mode = mode;
        
        // ボタンの状態を更新
        const spectrumBtn = document.getElementById('spectrum-mode-spectrum');
        const sonogramBtn = document.getElementById('spectrum-mode-sonogram');
        const updateControl = document.getElementById('sonogram-update-control');
        
        if (spectrumBtn && sonogramBtn) {
            if (mode === 'spectrum') {
                spectrumBtn.classList.add('active');
                sonogramBtn.classList.remove('active');
                // スペクトラムモードの時は更新頻度コントロールを非表示
                if (updateControl) {
                    updateControl.classList.add('hidden');
                }
            } else {
                spectrumBtn.classList.remove('active');
                sonogramBtn.classList.add('active');
                // ソノグラムモードの時は更新頻度コントロールを表示
                if (updateControl) {
                    updateControl.classList.remove('hidden');
                }
            }
        }
        
        // ソノグラムモードに切り替えた場合、バッファをリセット
        if (mode === 'sonogram') {
            this.resetSonogram();
        }
    }
    
    /**
     * ソノグラムの更新が必要かどうかをチェック
     * @returns {boolean} 更新が必要な場合true
     */
    shouldUpdateSonogram() {
        if (this.mode !== 'sonogram') return true; // スペクトラムモードは常に更新
        
        this.sonogramUpdateCounter++;
        if (this.sonogramUpdateCounter >= this.sonogramUpdateRate) {
            this.sonogramUpdateCounter = 0;
            return true;
        }
        return false;
    }
    
    resetSonogram() {
        this.sonogramData = [];
        this.sonogramColumnIndex = 0;
        this.updateSonogramMaxColumns();
    }
    
    updateSonogramMaxColumns() {
        // キャンバス幅に応じて最大列数を計算（1ピクセル = 1列）
        this.sonogramMaxColumns = Math.floor(this.width);
    }
    
    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const oldWidth = this.width;
        this.width = rect.width;
        this.height = rect.height;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        
        // 幅が変わった場合、ソノグラムの最大列数を更新
        if (oldWidth !== this.width) {
            this.updateSonogramMaxColumns();
            // ソノグラムデータをリセット（幅が変わったため）
            if (this.mode === 'sonogram') {
                this.resetSonogram();
            }
        }
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
        
        if (this.mode === 'sonogram') {
            this.drawSonogram(frequencyData, sampleRate, fftSize);
        } else {
            this.drawSpectrum(frequencyData, sampleRate, fftSize);
        }
    }
    
    /**
     * スペクトラム表示を描画
     */
    drawSpectrum(frequencyData, sampleRate, fftSize) {
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
     * ソノグラム表示を描画
     */
    drawSonogram(frequencyData, sampleRate, fftSize) {
        const ctx = this.ctx;
        const width = this.width;
        const height = this.height;
        
        // 現在の周波数データをバッファに追加
        const columnData = new Uint8Array(frequencyData.length);
        for (let i = 0; i < frequencyData.length; i++) {
            columnData[i] = frequencyData[i];
        }
        
        // バッファに追加（左から右へ）
        // sonogramColumnIndexは0からsonogramMaxColumns-1まで循環
        const colIndex = this.sonogramColumnIndex % this.sonogramMaxColumns;
        this.sonogramData[colIndex] = columnData;
        this.sonogramColumnIndex++;
        
        // 背景をクリア
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        
        // ソノグラムを描画（対数スケール）
        const columnWidth = width / this.sonogramMaxColumns;
        
        // 対数スケール用のパラメータ
        const minFreq = 20; // 最小周波数（Hz）
        const maxFreq = sampleRate / 2; // 最大周波数（ナイキスト周波数）
        const logMin = Math.log10(minFreq);
        const logMax = Math.log10(maxFreq);
        const logRange = logMax - logMin;
        
        // 左から右へ描画
        // まだ右端まで埋まっていない場合は、埋まっている分だけ描画
        // 右端まで埋まった場合は、全列を描画（左から上書き）
        const isFilled = this.sonogramColumnIndex >= this.sonogramMaxColumns;
        const numColumnsToDraw = isFilled ? this.sonogramMaxColumns : this.sonogramColumnIndex;
        
        for (let displayCol = 0; displayCol < numColumnsToDraw; displayCol++) {
            // データのインデックスを計算
            let dataIndex;
            if (isFilled) {
                // 右端まで埋まった場合：左から上書き
                // 最新のデータは (sonogramColumnIndex - 1) % sonogramMaxColumns
                // 左端（displayCol=0）が最新のデータから数えて何番目か
                const offset = displayCol;
                dataIndex = (this.sonogramColumnIndex - 1 - offset + this.sonogramMaxColumns) % this.sonogramMaxColumns;
            } else {
                // まだ右端まで埋まっていない場合：左から順に
                dataIndex = displayCol;
            }
            
            const columnData = this.sonogramData[dataIndex];
            if (!columnData) continue;
            
            const x = displayCol * columnWidth;
            
            // 対数スケールで周波数ビンをマッピング
            // 各周波数ビンの境界を計算して描画（下から上へ、低周波数から高周波数へ）
            let currentY = height; // 現在の描画位置（下から上へ）
            
            for (let freqBin = 0; freqBin < columnData.length; freqBin++) {
                const value = columnData[freqBin];
                
                // 周波数ビンの下限と上限を計算（線形）
                const binStartFreq = (freqBin / columnData.length) * maxFreq;
                const binEndFreq = ((freqBin + 1) / columnData.length) * maxFreq;
                
                // 最小周波数未満のビンはスキップ
                if (binEndFreq < minFreq) continue;
                
                // ビンの境界を対数スケールでY座標に変換
                const binStartLog = Math.log10(Math.max(minFreq, binStartFreq));
                const binEndLog = Math.log10(binEndFreq);
                
                const normalizedStartLog = (binStartLog - logMin) / logRange;
                const normalizedEndLog = (binEndLog - logMin) / logRange;
                
                const yBottom = height - normalizedStartLog * height; // ビンの下端（低周波数側）
                const yTop = height - normalizedEndLog * height;      // ビンの上端（高周波数側）
                
                // ビンの高さを計算
                const binHeight = yBottom - yTop;
                
                if (binHeight > 0 && yTop >= 0 && yBottom <= height) {
                    // カラーマップを適用（黒→青→オレンジ→黄色→白）
                    const color = this.valueToColor(value);
                    
                    ctx.fillStyle = color;
                    // 下から上へ連続的に描画
                    ctx.fillRect(x, yTop, columnWidth, binHeight);
                }
            }
        }
        
        // 周波数軸のラベルを描画（簡易版）
        this.drawSonogramLabels(ctx, width, height, sampleRate, fftSize);
    }
    
    /**
     * 値（0-255）をカラーに変換
     * 黒→青→オレンジ→黄色→白のグラデーション
     */
    valueToColor(value) {
        const normalized = value / 255; // 0.0 - 1.0
        
        if (normalized < 0.25) {
            // 黒 → 青 (0.0 - 0.25)
            const t = normalized / 0.25;
            const r = 0;
            const g = Math.floor(t * 100);
            const b = Math.floor(50 + t * 155);
            return `rgb(${r}, ${g}, ${b})`;
        } else if (normalized < 0.5) {
            // 青 → オレンジ (0.25 - 0.5)
            const t = (normalized - 0.25) / 0.25;
            const r = Math.floor(t * 255);
            const g = Math.floor(100 + t * 100);
            const b = Math.floor(205 - t * 155);
            return `rgb(${r}, ${g}, ${b})`;
        } else if (normalized < 0.75) {
            // オレンジ → 黄色 (0.5 - 0.75)
            const t = (normalized - 0.5) / 0.25;
            const r = 255;
            const g = Math.floor(200 + t * 55);
            const b = Math.floor(50 - t * 50);
            return `rgb(${r}, ${g}, ${b})`;
        } else {
            // 黄色 → 白 (0.75 - 1.0)
            const t = (normalized - 0.75) / 0.25;
            const r = 255;
            const g = Math.floor(255 - t * 55);
            const b = Math.floor(t * 255);
            return `rgb(${r}, ${g}, ${b})`;
        }
    }
    
    /**
     * ソノグラム用のラベルを描画（対数スケール）
     */
    drawSonogramLabels(ctx, width, height, sampleRate, fftSize) {
        ctx.fillStyle = '#999';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        // 周波数ラベル（左側）- 画像のように詳細なラベル
        const freqLabels = [
            20000, 15000, 12000, 10000, 8000, 7000, 6000, 5000, 4000, 3500,
            3000, 2500, 2000, 1500, 1200, 1000, 700, 500, 300, 200, 100
        ];
        const maxFreq = sampleRate / 2;
        
        // 対数スケール用のパラメータ
        const minFreq = 20; // 最小周波数（Hz）
        const logMin = Math.log10(minFreq);
        const logMax = Math.log10(maxFreq);
        const logRange = logMax - logMin;
        
        freqLabels.forEach(freq => {
            if (freq >= minFreq && freq <= maxFreq) {
                // 対数スケールでY座標を計算
                const logFreq = Math.log10(freq);
                const normalizedLog = (logFreq - logMin) / logRange;
                const y = height - normalizedLog * height;
                
                if (y >= 0 && y <= height) {
                    ctx.fillText(this.formatFrequency(freq), 5, y);
                }
            }
        });
        
        // 単位ラベル（最下部）
        ctx.textBaseline = 'bottom';
        ctx.fillText('Hz', 5, height - 2);
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
            const khz = freq / 1000;
            // 整数の場合は小数点以下を表示しない
            if (khz === Math.floor(khz)) {
                return Math.floor(khz) + 'k';
            }
            // 小数点以下1桁まで表示
            return khz.toFixed(1) + 'k';
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
        
        if (this.mode === 'sonogram') {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);
            // ソノグラムデータもリセット
            this.resetSonogram();
        } else {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, width, height);
        }
        
        // メッセージを表示
        ctx.fillStyle = '#666';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('再生中にスペクトラムが表示されます', width / 2, height / 2);
    }
}
