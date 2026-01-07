// 3-Band MultiBand Up/Down Comp
class MultiBandComp {
    constructor(audioContext, audioPlayer) {
        this.audioContext = audioContext;
        this.audioPlayer = audioPlayer;
        
        // バンド分割用のフィルター
        this.lowFilter = null;
        this.midFilter = null;
        this.highFilter = null;
        
        // コンプレッサー
        this.lowComp = null;
        this.midComp = null;
        this.highComp = null;
        
        // パラメータ
        this.params = {
            low: { up: 0, down: 0 },
            mid: { up: 0, down: 0 },
            high: { up: 0, down: 0 },
            mix: 100
        };
        
        this.setupFilters();
        this.setupEventListeners();
    }
    
    setupFilters() {
        if (!this.audioContext) return;
        
        // ローパスフィルター（低域用）
        this.lowFilter = this.audioContext.createBiquadFilter();
        this.lowFilter.type = 'lowpass';
        this.lowFilter.frequency.value = 250;
        
        // ハイパスフィルター（高域用）
        this.highFilter = this.audioContext.createBiquadFilter();
        this.highFilter.type = 'highpass';
        this.highFilter.frequency.value = 4000;
        
        // ミッドバンドはバンドパスフィルターで実現
        this.midFilter = this.audioContext.createBiquadFilter();
        this.midFilter.type = 'bandpass';
        this.midFilter.frequency.value = 1000;
        this.midFilter.Q.value = 1;
    }
    
    setupEventListeners() {
        // スライダーのイベントリスナーを設定
        const sliders = [
            { id: 'comp-h-up', param: 'high', type: 'up' },
            { id: 'comp-h-down', param: 'high', type: 'down' },
            { id: 'comp-m-up', param: 'mid', type: 'up' },
            { id: 'comp-m-down', param: 'mid', type: 'down' },
            { id: 'comp-l-up', param: 'low', type: 'up' },
            { id: 'comp-l-down', param: 'low', type: 'down' },
            { id: 'comp-mix', param: 'mix', type: 'mix' }
        ];
        
        sliders.forEach(slider => {
            const element = document.getElementById(slider.id);
            if (element) {
                element.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    if (slider.param === 'mix') {
                        this.params.mix = value;
                    } else {
                        this.params[slider.param][slider.type] = value;
                    }
                    this.updateDisplay();
                    this.applyCompression();
                });
            }
        });
    }
    
    updateDisplay() {
        // 表示値を更新
        document.getElementById('comp-h-up-value').textContent = Math.round(this.params.high.up) + '%';
        document.getElementById('comp-h-down-value').textContent = Math.round(this.params.high.down) + '%';
        document.getElementById('comp-m-up-value').textContent = Math.round(this.params.mid.up) + '%';
        document.getElementById('comp-m-down-value').textContent = Math.round(this.params.mid.down) + '%';
        document.getElementById('comp-l-up-value').textContent = Math.round(this.params.low.up) + '%';
        document.getElementById('comp-l-down-value').textContent = Math.round(this.params.low.down) + '%';
        document.getElementById('comp-mix-value').textContent = Math.round(this.params.mix) + '%';
    }
    
    applyCompression() {
        // コンプレッションを適用
        // 注意: 実際のコンプレッション処理はAudioPlayerと統合する必要がある
        if (this.audioPlayer) {
            this.audioPlayer.updateMultiBandComp(this.params);
        }
    }
    
    enable() {
        const sliders = document.querySelectorAll('.multiband-comp-container .slider');
        sliders.forEach(slider => {
            slider.disabled = false;
        });
    }
    
    disable() {
        const sliders = document.querySelectorAll('.multiband-comp-container .slider');
        sliders.forEach(slider => {
            slider.disabled = true;
        });
    }
}
