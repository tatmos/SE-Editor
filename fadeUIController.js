// フェードカーブUIコントローラ（波形上にオーバーレイ表示）
class FadeUIController {
    /**
     * @param {LoopMaker} loopMaker
     * @param {HTMLCanvasElement} canvas1 - トラック1用フェードUIキャンバス
     * @param {HTMLCanvasElement} canvas2 - トラック2用フェードUIキャンバス
     */
    constructor(loopMaker, canvas1, canvas2) {
        this.loopMaker = loopMaker;
        this.canvas1 = canvas1;
        this.canvas2 = canvas2;
        this.ctx1 = canvas1.getContext('2d');
        this.ctx2 = canvas2.getContext('2d');

        // ドラッグ状態
        this.dragging = null; // 'track1' | 'track2' | null

        this.setupEventListeners();
        this.updateCanvasSize();
    }

    lockScroll() {
        if (typeof document !== 'undefined') {
            document.body.style.overflow = 'hidden';
            if (document.documentElement) {
                document.documentElement.style.overflow = 'hidden';
            }
        }
    }

    unlockScroll() {
        if (typeof document !== 'undefined') {
            document.body.style.overflow = '';
            if (document.documentElement) {
                document.documentElement.style.overflow = '';
            }
        }
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.updateCanvasSize();
            this.render();
        });

        const handlePointerDown = (track, clientX, clientY, e) => {
            const canvas = track === 'track1' ? this.canvas1 : this.canvas2;
            const rect = canvas.getBoundingClientRect();
            const xPx = clientX - rect.left;
            const yPx = clientY - rect.top;
            const xNorm = xPx / rect.width;
            const yNorm = yPx / rect.height;

            // アンカー上かどうかを判定
            const onAnchor = this.isOnAnchor(track, xPx, yPx);

            if (onAnchor) {
                // フェードコントローラとして動作（アンカーのみドラッグ可能）
                this.setControlPoint(track, xNorm, yNorm);
                this.dragging = track;
                this.lockScroll();
                if (e) {
                    e.stopPropagation();
                    e.preventDefault();
                }
            } else {
                // アンカー以外は波形クリックとして扱い、再生位置移動
                if (this.loopMaker && this.loopMaker.track1Buffer && this.loopMaker.audioPlayer && this.loopMaker.audioPlayer.isPlaying) {
                    const duration = this.loopMaker.track1Buffer.duration;
                    if (duration > 0) {
                        const ratio = Math.min(1, Math.max(0, xPx / rect.width));
                        const targetTime = duration * ratio;
                        this.loopMaker.seekTo(targetTime);
                    }
                }
            }
        };

        const handlePointerMove = (clientX, clientY) => {
            if (!this.dragging) return;
            const canvas = this.dragging === 'track1' ? this.canvas1 : this.canvas2;
            const rect = canvas.getBoundingClientRect();
            const x = (clientX - rect.left) / rect.width;
            const y = (clientY - rect.top) / rect.height;

            this.setControlPoint(this.dragging, x, y);
        };

        const handlePointerUp = () => {
            if (this.dragging) {
                this.dragging = null;
                this.unlockScroll();
            }
        };

        // マウス
        this.canvas1.addEventListener('mousedown', (e) => handlePointerDown('track1', e.clientX, e.clientY, e));
        this.canvas2.addEventListener('mousedown', (e) => handlePointerDown('track2', e.clientX, e.clientY, e));
        window.addEventListener('mousemove', (e) => handlePointerMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', handlePointerUp);

        // タッチ（iOS対応）
        const onTouchStart = (track, e) => {
            const touch = e.touches[0];
            if (!touch) return;
            const wasDragging = this.dragging !== null;
            handlePointerDown(track, touch.clientX, touch.clientY, e);
            // ドラッグが開始された場合のみ preventDefault
            if (this.dragging !== null && !wasDragging) {
                e.preventDefault();
            }
        };

        const onTouchMove = (e) => {
            const touch = e.touches[0];
            if (!touch) return;
            // ドラッグ中のみ preventDefault
            if (this.dragging !== null) {
                e.preventDefault();
            }
            handlePointerMove(touch.clientX, touch.clientY);
        };

        const onTouchEnd = () => {
            handlePointerUp();
        };

        const onTouchCancel = () => {
            // タッチがキャンセルされた場合も確実に解除
            handlePointerUp();
        };

        this.canvas1.addEventListener('touchstart', (e) => onTouchStart('track1', e), { passive: false });
        this.canvas2.addEventListener('touchstart', (e) => onTouchStart('track2', e), { passive: false });
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd);
        window.addEventListener('touchcancel', onTouchCancel);
    }

    updateCanvasSize() {
        [this.canvas1, this.canvas2].forEach((canvas) => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        });
    }

    /**
     * コントロールポイント設定（0〜1正規化座標）
     */
    setControlPoint(track, nx, ny) {
        // キャンバス座標（左上0,0）→ フェード値（x 0〜1, y 0〜1 上が1）
        const clampedX = Math.min(0.9, Math.max(0.1, nx));
        const clampedY = Math.min(0.9, Math.max(0.1, ny));
        const valueY = 1 - clampedY;

        if (track === 'track1') {
            this.loopMaker.fadeSettingsTrack1.controlX = clampedX;
            this.loopMaker.fadeSettingsTrack1.controlY = valueY;
            // アンカーを動かしたらカスタムカーブとして扱う
            this.loopMaker.fadeSettingsTrack1.mode = 'custom';
        } else {
            this.loopMaker.fadeSettingsTrack2.controlX = clampedX;
            this.loopMaker.fadeSettingsTrack2.controlY = valueY;
            // アンカーを動かしたらカスタムカーブとして扱う
            this.loopMaker.fadeSettingsTrack2.mode = 'custom';
        }

        // バッファを再生成して再描画
        this.loopMaker.updateBuffers();
        this.loopMaker.drawWaveforms();
        this.render();
    }

    render() {
        this.drawTrackFade(this.ctx1, this.canvas1, 'track1', true);
        this.drawTrackFade(this.ctx2, this.canvas2, 'track2', false);
    }

    /**
     * アンカー上かどうかのヒットテスト（キャンバス座標）
     */
    isOnAnchor(track, xPx, yPx) {
        const canvas = track === 'track1' ? this.canvas1 : this.canvas2;
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;

        const settings = track === 'track1'
            ? this.loopMaker.fadeSettingsTrack1
            : this.loopMaker.fadeSettingsTrack2;

        if (!settings) return false;

        // フェード幅（トラック長に対するフェード区間）
        const r = this.loopMaker.overlapRate || 0;
        if (r <= 0) return false;
        const fadeWidthRatio = r / (100 - r);
        const fadeWidth = width * Math.min(1, Math.max(0, fadeWidthRatio));
        if (fadeWidth <= 0) return false;

        const mode = settings.mode;
        const cp = { controlX: settings.controlX, controlY: settings.controlY };

        // アンカー位置（t=0.5 のカーブ上）
        const tMid = 0.5;
        let vMid = FadeCurves.evaluate(mode, tMid, cp);
        if (track === 'track2') {
            // トラック2はフェードアウト表示なので反転
            vMid = 1 - vMid;
        }
        const xMid = tMid * fadeWidth;
        const yMid = (1 - vMid) * height;

        const dx = xPx - xMid;
        const dy = yPx - yMid;
        const distSq = dx * dx + dy * dy;
        // タッチ環境でも掴みやすいように少し大きめの半径
        const radius = 18; // ピクセル
        return distSq <= radius * radius;
    }

    drawTrackFade(ctx, canvas, track, isFadeIn) {
        const width = canvas.width = canvas.offsetWidth;
        const height = canvas.height = canvas.offsetHeight;
        ctx.clearRect(0, 0, width, height);

        const settings = track === 'track1'
            ? this.loopMaker.fadeSettingsTrack1
            : this.loopMaker.fadeSettingsTrack2;

        if (!settings) return;

        // フェードUIの表示幅をフェード範囲のみに限定
        // オーバーラップ率 r(0〜50) のとき、フェード時間は元長の r% 、
        // トラック長は (100 - r)% → フェード長/トラック長 = r / (100 - r)
        const r = this.loopMaker.overlapRate || 0;
        if (r <= 0) return;
        const fadeWidthRatio = r / (100 - r);
        const fadeWidth = width * Math.min(1, Math.max(0, fadeWidthRatio));
        if (fadeWidth <= 0) return;

        const mode = settings.mode;
        const cp = { controlX: settings.controlX, controlY: settings.controlY };

        // カーブ描画
        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = track === 'track1' ? 'rgba(102, 126, 234, 0.9)' : 'rgba(118, 75, 162, 0.9)';
        ctx.beginPath();
        const steps = 64;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            let v = FadeCurves.evaluate(mode, t, cp);
            if (!isFadeIn) {
                v = 1 - v; // フェードアウトは逆カーブ
            }
            const x = t * fadeWidth;
            const y = (1 - v) * height;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();

        // コントロールポイントを描画（カーブ上の t=0.5 相当位置）
        const tMid = 0.5;
        let vMid = FadeCurves.evaluate(mode, tMid, cp);
        if (!isFadeIn) {
            vMid = 1 - vMid;
        }
        const xMid = tMid * fadeWidth;
        const yMid = (1 - vMid) * height;

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(xMid, yMid, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }
}


