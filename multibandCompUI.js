// 3-Band MultiBand Comp UI部分
class MultiBandCompUI {
    constructor(audioProcessor) {
        this.audioProcessor = audioProcessor;
        
        // HTMLのスライダーから初期値を読み取る
        const getSliderValue = (id, defaultValue) => {
            const element = document.getElementById(id);
            return element ? parseFloat(element.value) : defaultValue;
        };
        
        this.params = {
            low:  { 
                up: getSliderValue('comp-l-up', 0),
                down: getSliderValue('comp-l-down', 0),
                gain: getSliderValue('comp-l-gain', 100)
            },
            mid:  { 
                up: getSliderValue('comp-m-up', 0),
                down: getSliderValue('comp-m-down', 0),
                gain: getSliderValue('comp-m-gain', 100)
            },
            high: { 
                up: getSliderValue('comp-h-up', 0),
                down: getSliderValue('comp-h-down', 0),
                gain: getSliderValue('comp-h-gain', 100)
            },
            mix: getSliderValue('comp-mix', 100)
        };
        
        this.setupEventListeners();
        this.updateDisplay();
        // 初期化時にプロセッサーに値を反映
        this.updateProcessor();
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
            { id: 'comp-h-gain', param: 'high', type: 'gain' },
            { id: 'comp-m-gain', param: 'mid', type: 'gain' },
            { id: 'comp-l-gain', param: 'low', type: 'gain' },
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
                        // gain と up/down をまとめて扱う
                        this.params[slider.param][slider.type] = value;
                    }
                    this.updateDisplay();
                    this.updateProcessor();
                });
            }
        });
    }
    
    updateDisplay() {
        // 表示値を更新
        const elements = {
            'comp-h-up-value': Math.round(this.params.high.up),
            'comp-h-down-value': Math.round(this.params.high.down),
            'comp-h-gain-value': Math.round(this.params.high.gain),
            'comp-m-up-value': Math.round(this.params.mid.up),
            'comp-m-down-value': Math.round(this.params.mid.down),
            'comp-m-gain-value': Math.round(this.params.mid.gain),
            'comp-l-up-value': Math.round(this.params.low.up),
            'comp-l-down-value': Math.round(this.params.low.down),
            'comp-l-gain-value': Math.round(this.params.low.gain),
            'comp-mix-value': Math.round(this.params.mix)
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value + '%';
            }
        });
    }
    
    updateProcessor() {
        if (this.audioProcessor) {
            this.audioProcessor.updateMultiBandComp(this.params);
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
    
    getParams() {
        return this.params;
    }
}
