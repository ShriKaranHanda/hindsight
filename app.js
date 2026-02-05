class OpticalMouseSimulator {
    constructor() {
        this.surfaceCanvas = document.getElementById('surfaceCanvas');
        this.sensorCanvas = document.getElementById('sensorCanvas');
        this.surfaceCtx = this.surfaceCanvas.getContext('2d');
        this.sensorCtx = this.sensorCanvas.getContext('2d');
        
        this.mouseX = 0;
        this.mouseY = 0;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.isMouseOver = false;
        
        this.surfaceImage = null;
        this.lastSensorFrame = null;
        
        this.settings = {
            sensorResolution: 32,
            sensorZoom: 12.5,
            samplingFPS: 60,
            grayscale: true,
            contrast: 1.0,
            threshold: false,
            thresholdValue: 128,
            noise: 0,
            blur: 0,
            searchRadius: 8
        };
        
        this.motion = {
            estimatedDx: 0,
            estimatedDy: 0,
            trueDx: 0,
            trueDy: 0,
            estimatedX: 0,
            estimatedY: 0,
            error: 0
        };
        
        // Feature tracking for improved accuracy
        this.features = [];
        this.maxFeatures = 8;
        
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = Date.now();
        
        this.init();
    }
    
    init() {
        this.generateProceduralSurface();
        this.setupEventListeners();
        this.startRenderLoop();
    }
    
    generateProceduralSurface() {
        const width = this.surfaceCanvas.width;
        const height = this.surfaceCanvas.height;
        const imageData = this.surfaceCtx.createImageData(width, height);
        const data = imageData.data;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                
                const noise1 = this.perlinNoise(x * 0.05, y * 0.05) * 0.5 + 0.5;
                const noise2 = this.perlinNoise(x * 0.1, y * 0.1) * 0.3 + 0.5;
                const noise3 = this.perlinNoise(x * 0.02, y * 0.02) * 0.2 + 0.5;
                
                const pattern = (Math.sin(x * 0.1) * Math.cos(y * 0.1) * 0.5 + 0.5) * 0.3;
                
                const value = (noise1 * 0.4 + noise2 * 0.3 + noise3 * 0.2 + pattern * 0.1) * 255;
                
                data[idx] = value;
                data[idx + 1] = value * 0.9;
                data[idx + 2] = value * 0.8;
                data[idx + 3] = 255;
            }
        }
        
        this.surfaceCtx.putImageData(imageData, 0, 0);
        
        this.surfaceImage = this.surfaceCtx.getImageData(0, 0, width, height);
    }
    
    perlinNoise(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        
        x -= Math.floor(x);
        y -= Math.floor(y);
        
        const u = this.fade(x);
        const v = this.fade(y);
        
        const a = this.p[X] + Y;
        const b = this.p[X + 1] + Y;
        
        return this.lerp(v,
            this.lerp(u, this.grad(this.p[a], x, y), this.grad(this.p[b], x - 1, y)),
            this.lerp(u, this.grad(this.p[a + 1], x, y - 1), this.grad(this.p[b + 1], x - 1, y - 1))
        );
    }
    
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    
    lerp(t, a, b) {
        return a + t * (b - a);
    }
    
    grad(hash, x, y) {
        const h = hash & 3;
        const u = h < 2 ? x : y;
        const v = h < 2 ? y : x;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    
    get p() {
        if (!this._p) {
            const permutation = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
            this._p = new Array(512);
            for (let i = 0; i < 256; i++) {
                this._p[i] = this._p[i + 256] = permutation[i];
            }
        }
        return this._p;
    }
    
    setupEventListeners() {
        this.surfaceCanvas.addEventListener('mousemove', (e) => {
            const rect = this.surfaceCanvas.getBoundingClientRect();
            this.lastMouseX = this.mouseX;
            this.lastMouseY = this.mouseY;
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            
            if (!this.isMouseOver) {
                this.motion.estimatedX = this.mouseX;
                this.motion.estimatedY = this.mouseY;
            }
            
            this.isMouseOver = true;
            
            this.motion.trueDx = this.mouseX - this.lastMouseX;
            this.motion.trueDy = this.mouseY - this.lastMouseY;
        });
        
        this.surfaceCanvas.addEventListener('mouseleave', () => {
            this.isMouseOver = false;
        });
        
        this.surfaceCanvas.addEventListener('mouseenter', () => {
            this.isMouseOver = true;
        });
        
        document.getElementById('imageUpload').addEventListener('change', (e) => {
            this.loadCustomImage(e.target.files[0]);
        });
        
        document.getElementById('resetSurface').addEventListener('click', () => {
            this.generateProceduralSurface();
        });
        
        document.getElementById('sensorResolution').addEventListener('input', (e) => {
            this.settings.sensorResolution = parseInt(e.target.value);
            document.getElementById('resolutionValue').textContent = e.target.value;
            document.getElementById('resolutionValue2').textContent = e.target.value;
        });
        
        document.getElementById('sensorZoom').addEventListener('input', (e) => {
            this.settings.sensorZoom = parseFloat(e.target.value);
            document.getElementById('zoomValue').textContent = e.target.value;
        });
        
        document.getElementById('samplingFPS').addEventListener('input', (e) => {
            this.settings.samplingFPS = parseInt(e.target.value);
            document.getElementById('fpsValue').textContent = e.target.value;
        });
        
        document.getElementById('grayscale').addEventListener('change', (e) => {
            this.settings.grayscale = e.target.checked;
        });
        
        document.getElementById('contrast').addEventListener('input', (e) => {
            this.settings.contrast = parseFloat(e.target.value);
            document.getElementById('contrastValue').textContent = e.target.value;
        });
        
        document.getElementById('threshold').addEventListener('change', (e) => {
            this.settings.threshold = e.target.checked;
        });
        
        document.getElementById('thresholdValue').addEventListener('input', (e) => {
            this.settings.thresholdValue = parseInt(e.target.value);
            document.getElementById('thresholdLevelValue').textContent = e.target.value;
        });
        
        document.getElementById('noise').addEventListener('input', (e) => {
            this.settings.noise = parseInt(e.target.value);
            document.getElementById('noiseValue').textContent = e.target.value;
        });
        
        document.getElementById('blur').addEventListener('input', (e) => {
            this.settings.blur = parseFloat(e.target.value);
            document.getElementById('blurValue').textContent = e.target.value;
        });
        
        document.getElementById('searchRadius').addEventListener('input', (e) => {
            this.settings.searchRadius = parseInt(e.target.value);
            document.getElementById('searchRadiusValue').textContent = e.target.value;
        });
    }
    
    loadCustomImage(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.surfaceCtx.clearRect(0, 0, this.surfaceCanvas.width, this.surfaceCanvas.height);
                
                const scale = Math.min(
                    this.surfaceCanvas.width / img.width,
                    this.surfaceCanvas.height / img.height
                );
                const width = img.width * scale;
                const height = img.height * scale;
                const x = (this.surfaceCanvas.width - width) / 2;
                const y = (this.surfaceCanvas.height - height) / 2;
                
                this.surfaceCtx.drawImage(img, x, y, width, height);
                this.surfaceImage = this.surfaceCtx.getImageData(0, 0, this.surfaceCanvas.width, this.surfaceCanvas.height);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    startRenderLoop() {
        const targetFrameTime = 1000 / this.settings.samplingFPS;
        let lastFrameTime = Date.now();
        
        const loop = () => {
            const now = Date.now();
            const elapsed = now - lastFrameTime;
            
            if (elapsed >= targetFrameTime) {
                this.render();
                lastFrameTime = now - (elapsed % targetFrameTime);
                
                this.frameCount++;
                if (now - this.lastFpsUpdate >= 1000) {
                    this.fps = this.frameCount;
                    this.frameCount = 0;
                    this.lastFpsUpdate = now;
                }
            }
            
            requestAnimationFrame(loop);
        };
        
        loop();
    }
    
    render() {
        this.renderSurface();
        this.renderSensor();
        this.updateUI();
    }
    
    renderSurface() {
        if (this.surfaceImage) {
            this.surfaceCtx.putImageData(this.surfaceImage, 0, 0);
        }
        
        if (this.isMouseOver) {
            const sensorSize = this.settings.sensorResolution;
            
            // True position (Green)
            this.surfaceCtx.strokeStyle = '#4CAF50';
            this.surfaceCtx.lineWidth = 2;
            this.surfaceCtx.strokeRect(
                this.mouseX - sensorSize / 2,
                this.mouseY - sensorSize / 2,
                sensorSize,
                sensorSize
            );
            
            this.surfaceCtx.fillStyle = '#4CAF50';
            this.surfaceCtx.beginPath();
            this.surfaceCtx.arc(this.mouseX, this.mouseY, 3, 0, Math.PI * 2);
            this.surfaceCtx.fill();
            
            this.surfaceCtx.strokeStyle = '#4CAF50';
            this.surfaceCtx.lineWidth = 1;
            this.surfaceCtx.beginPath();
            this.surfaceCtx.moveTo(this.mouseX - 10, this.mouseY);
            this.surfaceCtx.lineTo(this.mouseX + 10, this.mouseY);
            this.surfaceCtx.moveTo(this.mouseX, this.mouseY - 10);
            this.surfaceCtx.lineTo(this.mouseX, this.mouseY + 10);
            this.surfaceCtx.stroke();

            // Estimated position (Red)
            this.surfaceCtx.strokeStyle = '#f44336';
            this.surfaceCtx.lineWidth = 2;
            this.surfaceCtx.strokeRect(
                this.motion.estimatedX - sensorSize / 2,
                this.motion.estimatedY - sensorSize / 2,
                sensorSize,
                sensorSize
            );

            this.surfaceCtx.fillStyle = '#f44336';
            this.surfaceCtx.beginPath();
            this.surfaceCtx.arc(this.motion.estimatedX, this.motion.estimatedY, 3, 0, Math.PI * 2);
            this.surfaceCtx.fill();

            this.surfaceCtx.strokeStyle = '#f44336';
            this.surfaceCtx.lineWidth = 1;
            this.surfaceCtx.beginPath();
            this.surfaceCtx.moveTo(this.motion.estimatedX - 10, this.motion.estimatedY);
            this.surfaceCtx.lineTo(this.motion.estimatedX + 10, this.motion.estimatedY);
            this.surfaceCtx.moveTo(this.motion.estimatedX, this.motion.estimatedY - 10);
            this.surfaceCtx.lineTo(this.motion.estimatedX, this.motion.estimatedY + 10);
            this.surfaceCtx.stroke();
        }
    }
    
    renderSensor() {
        if (!this.isMouseOver || !this.surfaceImage) {
            this.sensorCtx.fillStyle = '#000';
            this.sensorCtx.fillRect(0, 0, this.sensorCanvas.width, this.sensorCanvas.height);
            return;
        }
        
        const sensorSize = this.settings.sensorResolution;
        const halfSize = sensorSize / 2;
        
        const sourceX = Math.max(0, Math.min(this.surfaceCanvas.width - sensorSize, this.mouseX - halfSize));
        const sourceY = Math.max(0, Math.min(this.surfaceCanvas.height - sensorSize, this.mouseY - halfSize));
        
        const sensorData = this.surfaceCtx.getImageData(sourceX, sourceY, sensorSize, sensorSize);
        
        this.applySensorEffects(sensorData);
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sensorSize;
        tempCanvas.height = sensorSize;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(sensorData, 0, 0);
        
        this.sensorCtx.fillStyle = '#000';
        this.sensorCtx.fillRect(0, 0, this.sensorCanvas.width, this.sensorCanvas.height);
        
        this.sensorCtx.imageSmoothingEnabled = false;
        this.sensorCtx.drawImage(
            tempCanvas,
            0, 0, sensorSize, sensorSize,
            0, 0, this.sensorCanvas.width, this.sensorCanvas.height
        );
        
        if (this.lastSensorFrame) {
            this.estimateMotion(sensorData, this.lastSensorFrame);
            this.detectFeatures(sensorData);
        }
        
        this.lastSensorFrame = new ImageData(
            new Uint8ClampedArray(sensorData.data),
            sensorData.width,
            sensorData.height
        );
    }
    
    applySensorEffects(imageData) {
        const data = imageData.data;
        
        if (this.settings.grayscale) {
            for (let i = 0; i < data.length; i += 4) {
                const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                data[i] = data[i + 1] = data[i + 2] = gray;
            }
        }
        
        if (this.settings.contrast !== 1.0) {
            const factor = (259 * (this.settings.contrast * 255 + 255)) / (255 * (259 - this.settings.contrast * 255));
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
                data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
                data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
            }
        }
        
        if (this.settings.noise > 0) {
            for (let i = 0; i < data.length; i += 4) {
                const noise = (Math.random() - 0.5) * this.settings.noise * 2;
                data[i] = Math.min(255, Math.max(0, data[i] + noise));
                data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
                data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
            }
        }
        
        if (this.settings.blur > 0) {
            this.applyBoxBlur(imageData, this.settings.blur);
        }
        
        if (this.settings.threshold) {
            for (let i = 0; i < data.length; i += 4) {
                const value = data[i] > this.settings.thresholdValue ? 255 : 0;
                data[i] = data[i + 1] = data[i + 2] = value;
            }
        }
    }
    
    applyBoxBlur(imageData, radius) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const original = new Uint8ClampedArray(data);
        
        const kernelSize = Math.ceil(radius);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, count = 0;
                
                for (let ky = -kernelSize; ky <= kernelSize; ky++) {
                    for (let kx = -kernelSize; kx <= kernelSize; kx++) {
                        const px = x + kx;
                        const py = y + ky;
                        
                        if (px >= 0 && px < width && py >= 0 && py < height) {
                            const idx = (py * width + px) * 4;
                            r += original[idx];
                            g += original[idx + 1];
                            b += original[idx + 2];
                            count++;
                        }
                    }
                }
                
                const idx = (y * width + x) * 4;
                data[idx] = r / count;
                data[idx + 1] = g / count;
                data[idx + 2] = b / count;
            }
        }
    }
    
    estimateMotion(currentFrame, lastFrame) {
        const width = currentFrame.width;
        const height = currentFrame.height;
        const searchRadius = this.settings.searchRadius;
        
        // Phase 1: Feature-based tracking if available
        let bestDx = 0;
        let bestDy = 0;
        let bestScore = Infinity;
        
        if (this.features.length > 0) {
            const featureResult = this.trackFeatures(currentFrame, lastFrame);
            if (featureResult.confidence > 0.3) {
                bestDx = featureResult.dx;
                bestDy = featureResult.dy;
                bestScore = featureResult.error;
            }
        }
        
        // Phase 2: Coarse integer search as fallback or refinement
        if (this.features.length === 0 || bestScore === Infinity) {
            for (let dy = -searchRadius; dy <= searchRadius; dy++) {
                for (let dx = -searchRadius; dx <= searchRadius; dx++) {
                    const score = this.calculateSSD(currentFrame, lastFrame, dx, dy);
                    if (score < bestScore) {
                        bestScore = score;
                        bestDx = dx;
                        bestDy = dy;
                    }
                }
            }
        }
        
        // Phase 2: Sub-pixel refinement around best integer match
        const refined = this.subPixelRefinement(currentFrame, lastFrame, bestDx, bestDy);
        bestDx = refined.dx;
        bestDy = refined.dy;
        
        // Phase 3: Temporal smoothing to reduce jitter
        const smoothingFactor = 0.7;
        this.motion.estimatedDx = this.motion.estimatedDx * smoothingFactor + bestDx * (1 - smoothingFactor);
        this.motion.estimatedDy = this.motion.estimatedDy * smoothingFactor + bestDy * (1 - smoothingFactor);
        
        this.motion.estimatedX += this.motion.estimatedDx;
        this.motion.estimatedY += this.motion.estimatedDy;
        
        const errorDx = this.motion.estimatedDx - this.motion.trueDx;
        const errorDy = this.motion.estimatedDy - this.motion.trueDy;
        this.motion.error = Math.sqrt(errorDx * errorDx + errorDy * errorDy);
    }
    
    calculateSSD(currentFrame, lastFrame, dx, dy) {
        const width = currentFrame.width;
        const height = currentFrame.height;
        const data1 = currentFrame.data;
        const data2 = lastFrame.data;
        
        let score = 0;
        let count = 0;
        
        // Sample fewer points for better performance
        const step = 2;
        
        for (let y = 10; y < height - 10; y += step) {
            for (let x = 10; x < width - 10; x += step) {
                const currIdx = (y * width + x) * 4;
                const prevX = Math.round(x + dx);
                const prevY = Math.round(y + dy);
                
                if (prevX >= 0 && prevX < width && prevY >= 0 && prevY < height) {
                    const prevIdx = (prevY * width + prevX) * 4;
                    
                    // Use normalized cross-correlation for better accuracy
                    const diff = data1[currIdx] - data2[prevIdx];
                    score += diff * diff;
                    count++;
                }
            }
        }
        
        return count > 0 ? score / count : Infinity;
    }
    
    subPixelRefinement(currentFrame, lastFrame, intDx, intDy) {
        const refinementRadius = 0.5;
        const steps = 5;
        let bestDx = intDx;
        let bestDy = intDy;
        let bestScore = Infinity;
        
        for (let i = 0; i <= steps; i++) {
            for (let j = 0; j <= steps; j++) {
                const dx = intDx - refinementRadius + (2 * refinementRadius * i / steps);
                const dy = intDy - refinementRadius + (2 * refinementRadius * j / steps);
                
                const score = this.calculateBilinearSSD(currentFrame, lastFrame, dx, dy);
                if (score < bestScore) {
                    bestScore = score;
                    bestDx = dx;
                    bestDy = dy;
                }
            }
        }
        
        return { dx: bestDx, dy: bestDy };
    }
    
    calculateBilinearSSD(currentFrame, lastFrame, dx, dy) {
        const width = currentFrame.width;
        const height = currentFrame.height;
        const data1 = currentFrame.data;
        const data2 = lastFrame.data;
        
        let score = 0;
        let count = 0;
        const step = 3;
        
        for (let y = 10; y < height - 10; y += step) {
            for (let x = 10; x < width - 10; x += step) {
                const currIdx = (y * width + x) * 4;
                const prevX = x + dx;
                const prevY = y + dy;
                
                if (prevX >= 0 && prevX < width - 1 && prevY >= 0 && prevY < height - 1) {
                    const interpolated = this.bilinearInterpolation(data2, width, prevX, prevY);
                    const diff = data1[currIdx] - interpolated;
                    score += diff * diff;
                    count++;
                }
            }
        }
        
        return count > 0 ? score / count : Infinity;
    }
    
    bilinearInterpolation(data, width, x, y) {
        const x1 = Math.floor(x);
        const y1 = Math.floor(y);
        const x2 = x1 + 1;
        const y2 = y1 + 1;
        
        const fx = x - x1;
        const fy = y - y1;
        
        const idx11 = (y1 * width + x1) * 4;
        const idx21 = (y1 * width + x2) * 4;
        const idx12 = (y2 * width + x1) * 4;
        const idx22 = (y2 * width + x2) * 4;
        
        const val11 = data[idx11];
        const val21 = data[idx21];
        const val12 = data[idx12];
        const val22 = data[idx22];
        
        const val1 = val11 * (1 - fx) + val21 * fx;
        const val2 = val12 * (1 - fx) + val22 * fx;
        
        return val1 * (1 - fy) + val2 * fy;
    }
    
    detectFeatures(frame) {
        const width = frame.width;
        const height = frame.height;
        const data = frame.data;
        
        // Simple corner detection using Harris-like approach
        this.features = [];
        const threshold = 1000;
        const minDistance = 8;
        
        for (let y = 5; y < height - 5; y += 4) {
            for (let x = 5; x < width - 5; x += 4) {
                const score = this.calculateCornerScore(data, width, x, y);
                
                if (score > threshold) {
                    // Check minimum distance from existing features
                    let tooClose = false;
                    for (const feature of this.features) {
                        const dist = Math.sqrt((x - feature.x) ** 2 + (y - feature.y) ** 2);
                        if (dist < minDistance) {
                            tooClose = true;
                            break;
                        }
                    }
                    
                    if (!tooClose && this.features.length < this.maxFeatures) {
                        this.features.push({
                            x: x,
                            y: y,
                            score: score,
                            lastX: x,
                            lastY: y
                        });
                    }
                }
            }
        }
        
        // Sort by score and keep best features
        this.features.sort((a, b) => b.score - a.score);
        this.features = this.features.slice(0, this.maxFeatures);
    }
    
    calculateCornerScore(data, width, x, y) {
        // Simple gradient-based corner detection
        const idx = (y * width + x) * 4;
        
        // Calculate gradients in different directions
        const gx = data[(y * width + x + 1) * 4] - data[(y * width + x - 1) * 4];
        const gy = data[((y + 1) * width + x) * 4] - data[((y - 1) * width + x) * 4];
        const gxy = data[((y + 1) * width + x + 1) * 4] - data[((y - 1) * width + x - 1) * 4];
        
        // Harris corner score approximation
        return Math.abs(gx) + Math.abs(gy) + Math.abs(gxy);
    }
    
    trackFeatures(currentFrame, lastFrame) {
        if (this.features.length === 0) {
            return { dx: 0, dy: 0, confidence: 0, error: Infinity };
        }
        
        let totalDx = 0;
        let totalDy = 0;
        let trackedCount = 0;
        let totalError = 0;
        
        for (const feature of this.features) {
            const result = this.trackSingleFeature(currentFrame, lastFrame, feature);
            
            if (result.tracked) {
                totalDx += result.dx;
                totalDy += result.dy;
                totalError += result.error;
                trackedCount++;
                
                // Update feature position for next frame
                feature.lastX = feature.x;
                feature.lastY = feature.y;
                feature.x = result.newX;
                feature.y = result.newY;
            }
        }
        
        if (trackedCount === 0) {
            return { dx: 0, dy: 0, confidence: 0, error: Infinity };
        }
        
        const avgDx = totalDx / trackedCount;
        const avgDy = totalDy / trackedCount;
        const avgError = totalError / trackedCount;
        const confidence = trackedCount / this.features.length;
        
        return { dx: avgDx, dy: avgDy, confidence, error: avgError };
    }
    
    trackSingleFeature(currentFrame, lastFrame, feature) {
        const searchRadius = 5;
        const width = currentFrame.width;
        const height = currentFrame.height;
        const data1 = currentFrame.data;
        const data2 = lastFrame.data;
        
        let bestDx = 0;
        let bestDy = 0;
        let bestScore = Infinity;
        let tracked = false;
        
        // Extract feature patch from last frame
        const patchSize = 5;
        const patch = [];
        
        for (let py = -patchSize; py <= patchSize; py++) {
            for (let px = -patchSize; px <= patchSize; px++) {
                const x = feature.lastX + px;
                const y = feature.lastY + py;
                
                if (x >= 0 && x < width && y >= 0 && y < height) {
                    patch.push(data2[(y * width + x) * 4]);
                } else {
                    patch.push(0);
                }
            }
        }
        
        // Search for best match in current frame
        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
            for (let dx = -searchRadius; dx <= searchRadius; dx++) {
                const newX = feature.x + dx;
                const newY = feature.y + dy;
                
                if (newX >= patchSize && newX < width - patchSize && 
                    newY >= patchSize && newY < height - patchSize) {
                    
                    let score = 0;
                    let patchIdx = 0;
                    
                    for (let py = -patchSize; py <= patchSize; py++) {
                        for (let px = -patchSize; px <= patchSize; px++) {
                            const x = newX + px;
                            const y = newY + py;
                            const currVal = data1[(y * width + x) * 4];
                            const diff = currVal - patch[patchIdx++];
                            score += diff * diff;
                        }
                    }
                    
                    if (score < bestScore) {
                        bestScore = score;
                        bestDx = dx;
                        bestDy = dy;
                        tracked = true;
                    }
                }
            }
        }
        
        return {
            dx: bestDx,
            dy: bestDy,
            newX: feature.x + bestDx,
            newY: feature.y + bestDy,
            error: bestScore,
            tracked: tracked
        };
    }
    
    updateUI() {
        document.getElementById('posX').textContent = Math.round(this.mouseX);
        document.getElementById('posY').textContent = Math.round(this.mouseY);
        document.getElementById('deltaX').textContent = this.motion.estimatedDx.toFixed(1);
        document.getElementById('deltaY').textContent = this.motion.estimatedDy.toFixed(1);
        document.getElementById('trueDeltaX').textContent = this.motion.trueDx.toFixed(1);
        document.getElementById('trueDeltaY').textContent = this.motion.trueDy.toFixed(1);
        document.getElementById('error').textContent = this.motion.error.toFixed(2);
        document.getElementById('fps').textContent = this.fps;
    }
}

const simulator = new OpticalMouseSimulator();
