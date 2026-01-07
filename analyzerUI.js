// Analyzer UI部分（描画）
class AnalyzerUI {
    constructor(canvas, audioProcessor) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.audioProcessor = audioProcessor;
        this.animationFrameId = null;
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
        if (!this.audioProcessor) {
            this.animationFrameId = requestAnimationFrame(() => this.animate());
            return;
        }
        
        const dataArray = this.audioProcessor.getFrequencyData();
        if (dataArray) {
            this.draw(dataArray);
        }
        
        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }
    
    draw(dataArray) {
        const width = this.canvas.width = this.canvas.offsetWidth;
        const height = this.canvas.height = this.canvas.offsetHeight;
        const ctx = this.ctx;
        
        // 背景をクリア
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
        
        if (!dataArray) return;
        
        const bufferLength = dataArray.length;
        const barWidth = (width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        
        // 周波数スペクトラムを描画
        for (let i = 0; i < bufferLength; i++) {
            barHeight = (dataArray[i] / 255) * height;
            
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
}
