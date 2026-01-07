// リージョン管理クラス
class RegionController {
    constructor(loopMaker, canvas, trackNumber) {
        this.loopMaker = loopMaker;
        this.canvas = canvas;
        this.trackNumber = trackNumber;
        this.ctx = canvas.getContext('2d');
        this.regions = []; // リージョンの配列
        this.selectedRegion = null;
        this.dragging = false;
        this.dragType = null; // 'move', 'resize-left', 'resize-right', 'resize-bottom', 'fade-in', 'fade-out', 'playback-start'
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragStartTime = 0;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
        
        // Altキーを押しながらドラッグで複製
        this.canvas.addEventListener('keydown', (e) => {
            if (e.altKey && this.dragging) {
                this.isDuplicating = true;
            }
        });
        this.canvas.addEventListener('keyup', (e) => {
            if (!e.altKey) {
                this.isDuplicating = false;
            }
        });
    }
    
    // リージョンを追加
    addRegion(startTime, endTime, sourceBuffer, sourceStartTime = 0) {
        const region = {
            id: Date.now() + Math.random(),
            startTime: startTime,
            endTime: endTime,
            sourceBuffer: sourceBuffer,
            sourceStartTime: sourceStartTime, // 元波形からの再生開始位置
            pitchShift: 0, // ピッチシフト（セミトーン）
            timeStretch: 1.0, // タイムストレッチ（1.0 = 通常）
            fadeInStart: startTime,
            fadeInEnd: startTime,
            fadeOutStart: endTime,
            fadeOutEnd: endTime,
            selected: false
        };
        this.regions.push(region);
        return region;
    }
    
    // リージョンを削除
    removeRegion(regionId) {
        this.regions = this.regions.filter(r => r.id !== regionId);
        if (this.selectedRegion && this.selectedRegion.id === regionId) {
            this.selectedRegion = null;
        }
    }
    
    // リージョンを選択
    selectRegion(region) {
        // すべてのリージョンの選択を解除
        this.regions.forEach(r => r.selected = false);
        if (region) {
            region.selected = true;
            this.selectedRegion = region;
        } else {
            this.selectedRegion = null;
        }
    }
    
    // マウス位置からリージョンを取得
    getRegionAt(x, y) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = x - rect.left;
        const canvasY = y - rect.top;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        const buffer = this.trackNumber === 1 ? this.loopMaker.track1Buffer : this.loopMaker.track2Buffer;
        if (!buffer) return null;
        
        const duration = buffer.duration;
        const timeScale = width / duration;
        const time = canvasX / timeScale;
        
        // リージョンを逆順でチェック（上に描画されているものを優先）
        for (let i = this.regions.length - 1; i >= 0; i--) {
            const region = this.regions[i];
            if (time >= region.startTime && time <= region.endTime) {
                return region;
            }
        }
        return null;
    }
    
    // ドラッグタイプを判定
    getDragType(region, x, y) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = x - rect.left;
        const canvasY = y - rect.top;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        const buffer = this.trackNumber === 1 ? this.loopMaker.track1Buffer : this.loopMaker.track2Buffer;
        if (!buffer) return null;
        
        const duration = buffer.duration;
        const timeScale = width / duration;
        const anchorSize = 8;
        
        const startX = region.startTime * timeScale;
        const endX = region.endTime * timeScale;
        const regionY = 0;
        const regionHeight = height;
        
        // 左上のアンカー（フェードイン）
        if (Math.abs(canvasX - startX) < anchorSize && Math.abs(canvasY - regionY) < anchorSize) {
            return 'fade-in';
        }
        
        // 右上のアンカー（フェードアウト）
        if (Math.abs(canvasX - endX) < anchorSize && Math.abs(canvasY - regionY) < anchorSize) {
            return 'fade-out';
        }
        
        // 右下のアンカー（タイムストレッチ）
        if (Math.abs(canvasX - endX) < anchorSize && Math.abs(canvasY - (regionY + regionHeight)) < anchorSize) {
            return 'resize-bottom';
        }
        
        // 左端（リサイズ左）
        if (Math.abs(canvasX - startX) < anchorSize) {
            return 'resize-left';
        }
        
        // 右端（リサイズ右）
        if (Math.abs(canvasX - endX) < anchorSize) {
            return 'resize-right';
        }
        
        // リージョン内（移動）
        if (canvasX >= startX && canvasX <= endX) {
            return 'move';
        }
        
        return null;
    }
    
    handleMouseDown(e) {
        const region = this.getRegionAt(e.clientX, e.clientY);
        
        if (region) {
            this.selectRegion(region);
            const dragType = this.getDragType(region, e.clientX, e.clientY);
            
            if (dragType) {
                this.dragging = true;
                this.dragType = dragType;
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
                this.dragStartTime = region.startTime;
                this.dragRegion = region;
                e.preventDefault();
            }
        } else {
            // リージョン外をクリックした場合は選択を解除
            this.selectRegion(null);
        }
        
        this.render();
    }
    
    handleMouseMove(e) {
        if (this.dragging && this.dragRegion) {
            const rect = this.canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            
            const width = this.canvas.width;
            const buffer = this.trackNumber === 1 ? this.loopMaker.track1Buffer : this.loopMaker.track2Buffer;
            if (!buffer) return;
            
            const duration = buffer.duration;
            const timeScale = width / duration;
            const deltaX = canvasX - (this.dragStartX - rect.left);
            const deltaTime = deltaX / timeScale;
            
            switch (this.dragType) {
                case 'move':
                    const newStartTime = this.dragStartTime + deltaTime;
                    const regionDuration = this.dragRegion.endTime - this.dragRegion.startTime;
                    if (newStartTime >= 0 && newStartTime + regionDuration <= duration) {
                        this.dragRegion.startTime = newStartTime;
                        this.dragRegion.endTime = newStartTime + regionDuration;
                    }
                    break;
                case 'resize-left':
                    const newStart = this.dragStartTime + deltaTime;
                    if (newStart >= 0 && newStart < this.dragRegion.endTime) {
                        this.dragRegion.startTime = newStart;
                    }
                    break;
                case 'resize-right':
                    const newEnd = this.dragRegion.endTime + deltaTime;
                    if (newEnd > this.dragRegion.startTime && newEnd <= duration) {
                        this.dragRegion.endTime = newEnd;
                    }
                    break;
                case 'fade-in':
                    // フェードインの調整
                    const fadeInTime = this.dragStartTime + deltaTime;
                    if (fadeInTime >= this.dragRegion.startTime && fadeInTime <= this.dragRegion.endTime) {
                        this.dragRegion.fadeInEnd = fadeInTime;
                    }
                    break;
                case 'fade-out':
                    // フェードアウトの調整
                    const fadeOutTime = this.dragRegion.endTime - (this.dragStartTime + deltaTime - this.dragRegion.endTime);
                    if (fadeOutTime >= this.dragRegion.startTime && fadeOutTime <= this.dragRegion.endTime) {
                        this.dragRegion.fadeOutStart = fadeOutTime;
                    }
                    break;
            }
            
            this.render();
            // バッファを更新
            this.loopMaker.updateBuffers();
        } else {
            // マウスオーバー時のカーソル変更
            const region = this.getRegionAt(e.clientX, e.clientY);
            if (region) {
                const dragType = this.getDragType(region, e.clientX, e.clientY);
                if (dragType === 'move') {
                    this.canvas.style.cursor = 'move';
                } else if (dragType === 'resize-left' || dragType === 'resize-right') {
                    this.canvas.style.cursor = 'ew-resize';
                } else if (dragType === 'fade-in' || dragType === 'fade-out') {
                    this.canvas.style.cursor = 'nwse-resize';
                } else {
                    this.canvas.style.cursor = 'default';
                }
            } else {
                this.canvas.style.cursor = 'default';
            }
        }
    }
    
    handleMouseUp(e) {
        if (this.dragging) {
            // Altキーが押されていた場合は複製
            if (this.isDuplicating && this.dragRegion) {
                const newRegion = this.addRegion(
                    this.dragRegion.startTime,
                    this.dragRegion.endTime,
                    this.dragRegion.sourceBuffer,
                    this.dragRegion.sourceStartTime
                );
                // 複製したリージョンを少しずらす
                const offset = (this.dragRegion.endTime - this.dragRegion.startTime) * 0.1;
                newRegion.startTime += offset;
                newRegion.endTime += offset;
                this.selectRegion(newRegion);
            }
            
            this.dragging = false;
            this.dragType = null;
            this.dragRegion = null;
            this.isDuplicating = false;
        }
        this.render();
    }
    
    // リージョンを描画
    render() {
        if (!this.canvas) return;
        
        const width = this.canvas.width = this.canvas.offsetWidth;
        const height = this.canvas.height = this.canvas.offsetHeight;
        const ctx = this.ctx;
        
        ctx.clearRect(0, 0, width, height);
        
        const buffer = this.trackNumber === 1 ? this.loopMaker.track1Buffer : this.loopMaker.track2Buffer;
        if (!buffer) return;
        
        const duration = buffer.duration;
        const timeScale = width / duration;
        
        // リージョンを描画
        this.regions.forEach(region => {
            const startX = region.startTime * timeScale;
            const endX = region.endTime * timeScale;
            const regionWidth = endX - startX;
            
            // リージョンの背景
            ctx.fillStyle = region.selected ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.1)';
            ctx.fillRect(startX, 0, regionWidth, height);
            
            // リージョンの境界線
            ctx.strokeStyle = region.selected ? '#667eea' : '#999';
            ctx.lineWidth = region.selected ? 2 : 1;
            ctx.strokeRect(startX, 0, regionWidth, height);
            
            // アンカーを描画
            const anchorSize = 8;
            ctx.fillStyle = region.selected ? '#667eea' : '#666';
            
            // 左上（フェードイン）
            ctx.fillRect(startX - anchorSize/2, -anchorSize/2, anchorSize, anchorSize);
            
            // 右上（フェードアウト）
            ctx.fillRect(endX - anchorSize/2, -anchorSize/2, anchorSize, anchorSize);
            
            // 右下（タイムストレッチ）
            ctx.fillRect(endX - anchorSize/2, height - anchorSize/2, anchorSize, anchorSize);
        });
    }
    
    // すべてのリージョンを取得
    getRegions() {
        return this.regions;
    }
    
    // リージョンをクリア
    clearRegions() {
        this.regions = [];
        this.selectedRegion = null;
    }
}
