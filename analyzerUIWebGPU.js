// Analyzer UI部分（WebGPU版）
class AnalyzerUIWebGPU {
    constructor(canvas, audioProcessor) {
        this.canvas = canvas;
        this.audioProcessor = audioProcessor;
        this.animationFrameId = null;
        
        // WebGPU関連
        this.device = null;
        this.computePipeline = null;
        this.inputBuffer = null;
        this.outputBuffer = null;
        this.bindGroup = null;
        this.commandEncoder = null;
        
        // ソノグラム用のバッファ（時間方向のデータを保持）
        this.bufferSize = 512;
        this.spectrogramBuffer = new Array(this.bufferSize);
        this.bufferIndex = 0;
        this.bufferCount = 0;
        
        // 描画用
        this.lastDrawnCount = 0;
        this.canvasContext = null;
        this.imageBitmap = null;
        this.isWebGPUReady = false;
        
        // 初期化（非同期だが、完了を待たない）
        this.initWebGPU().then(success => {
            this.isWebGPUReady = success;
        });
    }
    
    async initWebGPU() {
        try {
            // WebGPUが利用可能かチェック
            if (!navigator.gpu) {
                console.warn('WebGPU is not available, falling back to CPU rendering');
                return false;
            }
            
            // アダプターとデバイスを取得
            // powerPreferenceはWindowsで無視されるが、他のプラットフォームでは有効
            const adapter = await navigator.gpu.requestAdapter({
                powerPreference: 'high-performance'
            });
            
            if (!adapter) {
                console.warn('Failed to get WebGPU adapter');
                return false;
            }
            
            this.device = await adapter.requestDevice();
            
            // Canvasコンテキストを取得（WebGPUコンテキストは不要、Compute Shaderのみ使用）
            // WebGPU Canvasは描画に使用せず、Compute Shaderで処理した結果をCanvas 2Dに描画
            // そのため、WebGPUコンテキストの取得は不要
            
            // WebGPU Canvasは使用しない（Compute Shaderのみ使用）
            // 結果はCanvas 2Dに描画するため、WebGPUコンテキストの設定は不要
            
            // Compute Shaderを作成
            const computeShaderCode = `
                @group(0) @binding(0) var<storage, read> inputData: array<u32>;
                @group(0) @binding(1) var<storage, read_write> outputData: array<u32>;
                @group(0) @binding(2) var<uniform> params: SpectrogramParams;
                
                struct SpectrogramParams {
                    width: u32,
                    height: u32,
                    numFrequencies: u32,
                    numTimeFrames: u32,
                    startX: u32,
                    columnsToDraw: u32,
                }
                
                // 対数スケール変換
                // WGSLにはlog10がないため、log2とlog2(10)を使用
                fn logScaleToFreq(logScale: f32, minFreq: f32, maxFreq: f32) -> f32 {
                    let log2_10 = 3.321928094887362;
                    let logMin = log2(minFreq + 1.0) / log2_10;
                    let logMax = log2(maxFreq + 1.0) / log2_10;
                    let logFreq = logMin + logScale * (logMax - logMin);
                    // pow(10.0, logFreq) = pow(2.0, logFreq * log2(10))
                    return pow(2.0, logFreq * log2_10) - 1.0;
                }
                
                // 強度を色に変換（ヒートマップ風）
                fn intensityToColor(intensity: f32) -> vec3<u32> {
                    let clamped = clamp(intensity, 0.0, 1.0);
                    var r: u32 = 0u;
                    var g: u32 = 0u;
                    var b: u32 = 0u;
                    
                    if (clamped < 0.25) {
                        // 青から緑
                        let t = clamped / 0.25;
                        r = 0u;
                        g = u32(t * 255.0);
                        b = u32((1.0 - t) * 255.0);
                    } else if (clamped < 0.5) {
                        // 緑から黄
                        let t = (clamped - 0.25) / 0.25;
                        r = u32(t * 255.0);
                        g = 255u;
                        b = 0u;
                    } else if (clamped < 0.75) {
                        // 黄からオレンジ
                        let t = (clamped - 0.5) / 0.25;
                        r = 255u;
                        g = u32((1.0 - t) * 255.0);
                        b = 0u;
                    } else {
                        // オレンジから赤
                        let t = (clamped - 0.75) / 0.25;
                        r = 255u;
                        g = u32((1.0 - t) * 128.0);
                        b = 0u;
                    }
                    
                    return vec3<u32>(r, g, b);
                }
                
                @compute @workgroup_size(8, 8)
                fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
                    let x = globalId.x;
                    let y = globalId.y;
                    
                    if (x >= params.columnsToDraw || y >= params.height) {
                        return;
                    }
                    
                    // 時間フレームインデックスを計算
                    let timeIndex = params.numTimeFrames - params.columnsToDraw + x;
                    if (timeIndex >= params.numTimeFrames) {
                        return;
                    }
                    
                    // 周波数インデックスを計算（対数スケール）
                    let normalizedY = 1.0 - (f32(y) / f32(params.height));
                    let minFreq = 0.0;
                    let maxFreq = f32(params.numFrequencies - 1u);
                    let freqIndex = logScaleToFreq(normalizedY, minFreq, maxFreq);
                    let f = u32(clamp(freqIndex, 0.0, maxFreq));
                    
                    if (f >= params.numFrequencies) {
                        return;
                    }
                    
                    // 入力データから強度を取得
                    let inputIndex = timeIndex * params.numFrequencies + f;
                    if (inputIndex >= arrayLength(&inputData)) {
                        return;
                    }
                    
                    // u32として読み取り、u8値として扱う
                    let intensity = f32(inputData[inputIndex] & 0xFFu) / 255.0;
                    
                    // 色に変換
                    let color = intensityToColor(intensity);
                    
                    // 出力バッファに書き込み（RGBA形式、u32として格納）
                    let outputIndex = (y * params.columnsToDraw + x) * 4u;
                    if (outputIndex + 3u >= arrayLength(&outputData)) {
                        return;
                    }
                    
                    outputData[outputIndex] = color.r;
                    outputData[outputIndex + 1u] = color.g;
                    outputData[outputIndex + 2u] = color.b;
                    outputData[outputIndex + 3u] = 255u;
                }
            `;
            
            const computeShader = this.device.createShaderModule({
                code: computeShaderCode
            });
            
            // Compute Pipelineを作成
            this.computePipeline = this.device.createComputePipeline({
                layout: 'auto',
                compute: {
                    module: computeShader,
                    entryPoint: 'main'
                }
            });
            
            console.log('WebGPU initialized successfully');
            return true;
        } catch (error) {
            console.error('WebGPU initialization failed:', error);
            return false;
        }
    }
    
    start() {
        if (this.animationFrameId) return;
        // バッファをクリア
        this.spectrogramBuffer = new Array(this.bufferSize);
        this.bufferIndex = 0;
        this.bufferCount = 0;
        this.lastDrawnCount = 0;
        this.animate();
    }
    
    stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        // キャンバスをクリア（Canvas 2Dを使用）
        const width = this.canvas.width = this.canvas.offsetWidth;
        const height = this.canvas.height = this.canvas.offsetHeight;
        const ctx2d = this.canvas.getContext('2d');
        if (ctx2d) {
            ctx2d.fillStyle = '#1a1a1a';
            ctx2d.fillRect(0, 0, width, height);
        }
        // バッファもクリア
        this.spectrogramBuffer = new Array(this.bufferSize);
        this.bufferIndex = 0;
        this.bufferCount = 0;
        this.lastDrawnCount = 0;
    }
    
    animate() {
        if (!this.audioProcessor) {
            this.animationFrameId = requestAnimationFrame(() => this.animate());
            return;
        }
        
        const dataArray = this.audioProcessor.getFrequencyData();
        if (dataArray) {
            // スクロール速度を上げるため、毎フレーム複数回データを追加
            for (let i = 0; i < 5; i++) {
                this.addSpectrumColumn(dataArray);
            }
            // 非同期処理を同期的に実行（パフォーマンス向上のため）
            // ただし、エラーが発生した場合は次のフレームで続行
            if (this.isWebGPUReady) {
                this.drawSpectrogram().catch(err => {
                    console.error('WebGPU draw error in animate:', err);
                    // エラーが発生した場合はCPU版にフォールバック
                    this.isWebGPUReady = false;
                });
            } else {
                // WebGPUが準備できていない場合は何もしない（次のフレームで再試行）
            }
        }
        
        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }
    
    // 新しい周波数データをバッファに追加（循環バッファを使用）
    addSpectrumColumn(dataArray) {
        const newColumn = new Uint8Array(dataArray.length);
        for (let i = 0; i < dataArray.length; i++) {
            newColumn[i] = dataArray[i];
        }
        
        this.spectrogramBuffer[this.bufferIndex] = newColumn;
        this.bufferIndex = (this.bufferIndex + 1) % this.bufferSize;
        
        if (this.bufferCount < this.bufferSize) {
            this.bufferCount++;
        }
    }
    
    // ソノグラムを描画（WebGPU版）
    async drawSpectrogram() {
        if (!this.isWebGPUReady || !this.device || !this.computePipeline) {
            return;
        }
        
        if (this.bufferCount === 0) {
            const width = this.canvas.width = this.canvas.offsetWidth;
            const height = this.canvas.height = this.canvas.offsetHeight;
            const ctx2d = this.canvas.getContext('2d', { willReadFrequently: true });
            if (ctx2d) {
                ctx2d.fillStyle = '#1a1a1a';
                ctx2d.fillRect(0, 0, width, height);
            }
            return;
        }
        
        const width = this.canvas.width = this.canvas.offsetWidth;
        const height = this.canvas.height = this.canvas.offsetHeight;
        
        if (width === 0 || height === 0) return;
        
        const numFrequencies = this.spectrogramBuffer[0] ? this.spectrogramBuffer[0].length : 1024;
        const numTimeFrames = Math.min(this.bufferCount, width);
        
        // 新しい列の数を計算（毎フレーム5列追加されるため）
        const newColumns = Math.min(5, this.bufferCount - this.lastDrawnCount);
        
        // 描画する列数：新しい列がある場合は新しい列のみ、初回は全フレーム
        let columnsToDraw;
        if (this.lastDrawnCount === 0) {
            // 初回は全フレームを描画
            columnsToDraw = numTimeFrames;
        } else if (newColumns > 0) {
            // 新しい列のみ描画
            columnsToDraw = newColumns;
        } else {
            // データが増えていない場合は何もしない
            return;
        }
        
        // デバッグ用（開発時のみ）
        // console.log('WebGPU Draw:', { newColumns, columnsToDraw, bufferCount: this.bufferCount, lastDrawnCount: this.lastDrawnCount });
        
        try {
            // 入力データを準備（描画する列のデータのみ - パフォーマンス最適化）
            // u32配列として作成（WGSLの制約のため）
            const inputData = new Uint32Array(columnsToDraw * numFrequencies);
            for (let t = 0; t < columnsToDraw; t++) {
                let bufferPos;
                if (this.lastDrawnCount === 0) {
                    // 初回は全フレームを描画
                    bufferPos = (this.bufferIndex - numTimeFrames + t + this.bufferSize) % this.bufferSize;
                } else {
                    // 新しい列のみ描画
                    bufferPos = (this.bufferIndex - newColumns + t + this.bufferSize) % this.bufferSize;
                }
                const column = this.spectrogramBuffer[bufferPos];
                if (column) {
                    for (let f = 0; f < numFrequencies; f++) {
                        // u8値をu32として格納
                        inputData[t * numFrequencies + f] = column[f];
                    }
                }
            }
            
            // 入力バッファを作成/更新
            if (!this.inputBuffer || this.inputBuffer.size < inputData.byteLength) {
                if (this.inputBuffer) this.inputBuffer.destroy();
                this.inputBuffer = this.device.createBuffer({
                    size: inputData.byteLength,
                    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
                });
            }
            this.device.queue.writeBuffer(this.inputBuffer, 0, inputData);
            
            // 出力バッファを作成/更新（RGBA形式、各要素はu32 = 4 bytes）
            const outputSize = columnsToDraw * height * 4 * 4; // RGBA * 4 bytes each (u32)
            if (!this.outputBuffer || this.outputBuffer.size < outputSize) {
                if (this.outputBuffer) this.outputBuffer.destroy();
                this.outputBuffer = this.device.createBuffer({
                    size: outputSize,
                    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
                });
            }
            
            // パラメータバッファ
            const paramsBuffer = this.device.createBuffer({
                size: 6 * 4, // 6つのu32
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            
            const startX = newColumns > 0 ? width - newColumns : Math.max(0, width - numTimeFrames);
            const params = new Uint32Array([
                width,
                height,
                numFrequencies,
                numTimeFrames,
                startX,
                columnsToDraw
            ]);
            this.device.queue.writeBuffer(paramsBuffer, 0, params);
            
            // Bind Groupを作成
            this.bindGroup = this.device.createBindGroup({
                layout: this.computePipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.inputBuffer } },
                    { binding: 1, resource: { buffer: this.outputBuffer } },
                    { binding: 2, resource: { buffer: paramsBuffer } }
                ]
            });
            
            // Compute Passを実行
            const commandEncoder = this.device.createCommandEncoder();
            const computePass = commandEncoder.beginComputePass();
            computePass.setPipeline(this.computePipeline);
            computePass.setBindGroup(0, this.bindGroup);
            
            // ワークグループ数を計算（8x8のタイル）
            const workgroupX = Math.ceil(columnsToDraw / 8);
            const workgroupY = Math.ceil(height / 8);
            computePass.dispatchWorkgroups(workgroupX, workgroupY);
            computePass.end();
            
            // 出力バッファからデータを読み取り
            const tempBuffer = this.device.createBuffer({
                size: outputSize,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            });
            
            commandEncoder.copyBufferToBuffer(
                this.outputBuffer,
                0,
                tempBuffer,
                0,
                outputSize
            );
            
            this.device.queue.submit([commandEncoder.finish()]);
            
            // データを読み取り（unmapする前にコピー）
            await tempBuffer.mapAsync(GPUMapMode.READ);
            const mappedRange = tempBuffer.getMappedRange();
            const outputArrayU32 = new Uint32Array(mappedRange);
            
            // u32配列からu8配列に変換（unmapする前にコピー）
            const outputArrayU8 = new Uint8Array(columnsToDraw * height * 4);
            for (let i = 0; i < outputArrayU32.length; i++) {
                const value = outputArrayU32[i];
                // u32値をu8に変換（各バイトを抽出）
                outputArrayU8[i * 4] = value & 0xFF;
                outputArrayU8[i * 4 + 1] = (value >> 8) & 0xFF;
                outputArrayU8[i * 4 + 2] = (value >> 16) & 0xFF;
                outputArrayU8[i * 4 + 3] = (value >> 24) & 0xFF;
            }
            
            tempBuffer.unmap();
            
            // ImageDataを作成
            const imageData = new ImageData(columnsToDraw, height);
            // データをコピー（detached ArrayBufferを避けるため、直接コピー）
            for (let i = 0; i < outputArrayU8.length; i++) {
                imageData.data[i] = outputArrayU8[i];
            }
            
            // Canvas 2Dコンテキストで描画
            const ctx2d = this.canvas.getContext('2d', { willReadFrequently: true });
            if (ctx2d) {
                if (this.lastDrawnCount === 0) {
                    // 初回は背景をクリアして全フレームを描画
                    ctx2d.fillStyle = '#1a1a1a';
                    ctx2d.fillRect(0, 0, width, height);
                    ctx2d.putImageData(imageData, startX, 0);
                } else {
                    // 2回目以降：既存の画像を左にシフト（スクロール効果）
                    const shiftWidth = width - columnsToDraw;
                    if (shiftWidth > 0) {
                        // 既存の画像を左にシフト
                        const existingImage = ctx2d.getImageData(columnsToDraw, 0, shiftWidth, height);
                        ctx2d.putImageData(existingImage, 0, 0);
                        // 右端を背景色でクリア（新しい列を描画する前に）
                        ctx2d.fillStyle = '#1a1a1a';
                        ctx2d.fillRect(width - columnsToDraw, 0, columnsToDraw, height);
                    }
                    // 新しい列を右端に描画
                    ctx2d.putImageData(imageData, width - columnsToDraw, 0);
                }
                
                // 描画完了後にカウントを更新（重要：描画後に更新することで、次回のシフトが正しく動作する）
                this.lastDrawnCount = this.bufferCount;
            }
            
            // クリーンアップ
            paramsBuffer.destroy();
            tempBuffer.destroy();
        } catch (error) {
            console.error('WebGPU draw error:', error);
        }
    }
}
