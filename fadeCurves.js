// フェードカーブ関数群
class FadeCurves {
    /**
     * フェード値を評価する
     * @param {string} mode - 'linear' | 'log' | 'exp' | 'custom'
     * @param {number} t - 0〜1 の正規化時間
     * @param {{controlX:number, controlY:number}|null} controlPoint
     */
    static evaluate(mode, t, controlPoint = null) {
        const tt = Math.min(1, Math.max(0, t));

        if (mode === 'linear') {
            return tt;
        }

        if (mode === 'exp') {
            return this.exponential(tt);
        }

        if (mode === 'custom' && controlPoint) {
            return this.quadraticBezier(tt, controlPoint.controlX, controlPoint.controlY);
        }

        // デフォルトはログフェード
        return this.logarithmic(tt);
    }

    // 緩やかに立ち上がるログカーブ
    static logarithmic(t) {
        const k = 4; // カーブのきつさ
        return Math.log1p(k * t) / Math.log1p(k);
    }

    // 立ち上がりが早いエクスポネンシャルカーブ
    static exponential(t) {
        const k = 4;
        const ekt = Math.exp(k * t);
        const ek = Math.exp(k);
        return (ekt - 1) / (ek - 1);
    }

    // 単一コントロールポイントを持つ2次ベジェ
    // P0 = (0,0), P1 = (cx, cy), P2 = (1,1)
    static quadraticBezier(t, cx, cy) {
        const u = 1 - t;
        const x = 2 * u * t * cx + t * t; // 現在はxは使わず、tをそのまま時間とみなす
        const y = 2 * u * t * cy + t * t;
        return y;
    }
}


