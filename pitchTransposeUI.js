// ピッチトランスポーズ UI部分
class PitchTransposeUI {
    constructor(audioProcessor) {
        this.audioProcessor = audioProcessor;
        this.track1Transpose = 0;
        this.track1Cent = 0;
        this.track2Transpose = 0;
        this.track2Cent = 0;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // トラック1の移調
        const transpose1 = document.getElementById('pitch-transpose-track1');
        const cent1 = document.getElementById('pitch-cent-track1');
        
        if (transpose1) {
            transpose1.addEventListener('input', (e) => {
                this.track1Transpose = parseInt(e.target.value);
                this.updatePitch(1);
            });
        }
        
        if (cent1) {
            cent1.addEventListener('input', (e) => {
                this.track1Cent = parseInt(e.target.value);
                this.updatePitch(1);
            });
        }
        
        // トラック2の移調
        const transpose2 = document.getElementById('pitch-transpose-track2');
        const cent2 = document.getElementById('pitch-cent-track2');
        
        if (transpose2) {
            transpose2.addEventListener('input', (e) => {
                this.track2Transpose = parseInt(e.target.value);
                this.updatePitch(2);
            });
        }
        
        if (cent2) {
            cent2.addEventListener('input', (e) => {
                this.track2Cent = parseInt(e.target.value);
                this.updatePitch(2);
            });
        }
    }
    
    updatePitch(trackNumber) {
        if (!this.audioProcessor) return;
        
        if (trackNumber === 1) {
            this.audioProcessor.setPitchShift(1, this.track1Transpose, this.track1Cent);
        } else if (trackNumber === 2) {
            this.audioProcessor.setPitchShift(2, this.track2Transpose, this.track2Cent);
        }
    }
    
    enable() {
        const inputs = document.querySelectorAll('.pitch-input');
        inputs.forEach(input => {
            input.disabled = false;
        });
    }
    
    disable() {
        const inputs = document.querySelectorAll('.pitch-input');
        inputs.forEach(input => {
            input.disabled = true;
        });
    }
    
    getParams(trackNumber) {
        if (trackNumber === 1) {
            return { transpose: this.track1Transpose, cent: this.track1Cent };
        } else if (trackNumber === 2) {
            return { transpose: this.track2Transpose, cent: this.track2Cent };
        }
        return { transpose: 0, cent: 0 };
    }
}
