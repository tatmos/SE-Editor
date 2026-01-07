// 空間デザイン - X-Z平面での再生位置指定と残響効果
class SpatialDesign {
    constructor(canvas, audioPlayer) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.audioPlayer = audioPlayer;
        
        // トラックの位置（X-Z平面）
        this.track1Position = { x: 0, z: 0 };
        this.track2Position = { x: 0, z: 0 };
        
        // 残響パラメータ
        this.reverbMix = 0;
        
        this.dragging = false;
        this.dragTrack = null;
        
        this.setupEventListeners();
        this.render();
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
        
        // 残響Mixスライダー
        const reverbMixSlider = document.getElementById('reverb-mix');
        if (reverbMixSlider) {
            reverbMixSlider.addEventListener('input', (e) => {
                this.reverbMix = parseFloat(e.target.value);
                document.getElementById('reverb-mix-value').textContent = Math.round(this.reverbMix) + '%';
                this.updateReverb();
            });
        }
    }
    
    getTrackAt(x, y) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = x - rect.left;
        const canvasY = y - rect.top;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // 中心を原点とする座標系に変換
        const centerX = width / 2;
        const centerY = height / 2;
        const posX = (canvasX - centerX) / centerX;
        const posZ = (canvasY - centerY) / centerY;
        
        // トラック1の位置（左側）
        const track1X = this.track1Position.x * centerX + centerX;
        const track1Z = this.track1Position.z * centerY + centerY;
        const track1Radius = 15;
        
        if (Math.abs(canvasX - track1X) < track1Radius && Math.abs(canvasY - track1Z) < track1Radius) {
            return 1;
        }
        
        // トラック2の位置（右側）
        const track2X = this.track2Position.x * centerX + centerX;
        const track2Z = this.track2Position.z * centerY + centerY;
        const track2Radius = 15;
        
        if (Math.abs(canvasX - track2X) < track2Radius && Math.abs(canvasY - track2Z) < track2Radius) {
            return 2;
        }
        
        return null;
    }
    
    handleMouseDown(e) {
        const track = this.getTrackAt(e.clientX, e.clientY);
        if (track) {
            this.dragging = true;
            this.dragTrack = track;
            e.preventDefault();
        }
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        
        if (this.dragging && this.dragTrack) {
            // 中心を原点とする座標系に変換（-1から1の範囲）
            const posX = Math.max(-1, Math.min(1, (canvasX - centerX) / centerX));
            const posZ = Math.max(-1, Math.min(1, (canvasY - centerY) / centerY));
            
            if (this.dragTrack === 1) {
                this.track1Position = { x: posX, z: posZ };
            } else if (this.dragTrack === 2) {
                this.track2Position = { x: posX, z: posZ };
            }
            
            this.render();
            this.updateSpatialPosition();
        }
    }
    
    handleMouseUp(e) {
        this.dragging = false;
        this.dragTrack = null;
    }
    
    updateSpatialPosition() {
        if (this.audioPlayer) {
            this.audioPlayer.updateSpatialPosition(this.track1Position, this.track2Position);
        }
    }
    
    updateReverb() {
        if (this.audioPlayer) {
            this.audioPlayer.updateReverb(this.reverbMix);
        }
    }
    
    render() {
        const width = this.canvas.width = this.canvas.offsetWidth;
        const height = this.canvas.height = this.canvas.offsetHeight;
        const ctx = this.ctx;
        
        ctx.clearRect(0, 0, width, height);
        
        // 背景
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, width, height);
        
        const centerX = width / 2;
        const centerY = height / 2;
        
        // グリッドを描画
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        
        // 縦線
        for (let i = 0; i <= 4; i++) {
            const x = (width / 4) * i;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // 横線
        for (let i = 0; i <= 4; i++) {
            const y = (height / 4) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // 中心点
        ctx.fillStyle = '#667eea';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // トラック1の位置
        const track1X = this.track1Position.x * centerX + centerX;
        const track1Z = this.track1Position.z * centerY + centerY;
        ctx.fillStyle = '#667eea';
        ctx.beginPath();
        ctx.arc(track1X, track1Z, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('T1', track1X, track1Z + 4);
        
        // トラック2の位置
        const track2X = this.track2Position.x * centerX + centerX;
        const track2Z = this.track2Position.z * centerY + centerY;
        ctx.fillStyle = '#764ba2';
        ctx.beginPath();
        ctx.arc(track2X, track2Z, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('T2', track2X, track2Z + 4);
        
        // ラベル
        ctx.fillStyle = '#333';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('X軸（左右）', 10, 20);
        ctx.textAlign = 'right';
        ctx.fillText('Z軸（前後）', width - 10, height - 10);
    }
    
    enable() {
        const slider = document.getElementById('reverb-mix');
        if (slider) {
            slider.disabled = false;
        }
    }
    
    disable() {
        const slider = document.getElementById('reverb-mix');
        if (slider) {
            slider.disabled = true;
        }
    }
}
