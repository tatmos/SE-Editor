// Analyzer - Mix後の周波数表示
class Analyzer {
    constructor(canvas, audioPlayer) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.audioPlayer = audioPlayer;
        this.analyser = null;
        this.dataArray = null;
        this.animationFrameId = null;
        
        this.setupAnalyser();
    }
    
    setupAnalyser() {
        if (!this.audioPlayer) return;
        
        // AudioPlayerからMix後のAnalyserを取得
        // 注意: AudioPlayerを修正してMix後のAnalyserを提供する必要がある
        this.analyser = this.audioPlayer.getMixAnalyser();
        
        if (this.analyser) {
            this.analyser.fftSize = 2048;
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
        }
    }
    
    start() {
        if (this.animationFrameId) return;
        this.animate();
    }
    
    stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        // キャンバスをクリア
        const width = this.canvas.width;
        const height = this.canvas.height;
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, width, height);
    }
    
    animate() {
        if (!this.analyser || !this.dataArray) {
            this.animationFrameId = requestAnimationFrame(() => this.animate());
            return;
        }
        
        this.analyser.getByteFrequencyData(this.dataArray);
        this.draw();
        
        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }
    
    draw() {
        const width = this.canvas.width = this.canvas.offsetWidth;
        const height = this.canvas.height = this.canvas.offsetHeight;
        const ctx = this.ctx;
        
        // 背景をクリア
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
        
        if (!this.dataArray) return;
        
        const bufferLength = this.dataArray.length;
        const barWidth = (width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        
        // 周波数スペクトラムを描画
        for (let i = 0; i < bufferLength; i++) {
            barHeight = (this.dataArray[i] / 255) * height;
            
            // グラデーションで色を付ける
            const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
            gradient.addColorStop(0, '#00ff00');
            gradient.addColorStop(0.5, '#ffff00');
            gradient.addColorStop(1, '#ff0000');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);
            
            x += barWidth + 1;
        }
    }
    
    updateAnalyser(analyser) {
        this.analyser = analyser;
        if (this.analyser) {
            this.analyser.fftSize = 2048;
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
        }
    }
}
