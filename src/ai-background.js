import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';

let segmenterPromise = null;
const aiCache = new Map(); // `${src}_${mode}` -> Canvas

export async function getSegmenter() {
  if (segmenterPromise) return segmenterPromise;
  segmenterPromise = (async () => {
    try {
      let vision;
      try {
        vision = await FilesetResolver.forVisionTasks('/wasm');
      } catch {
        vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
      }

      const segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/models/selfie_segmenter.tflite',
          delegate: 'GPU',
        },
        runningMode: 'IMAGE',
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      });
      return segmenter;
    } catch (err) {
      console.warn('AI segmenter GPU initialization failed, falling back to CPU', err);
      try {
        let vision;
        try {
          vision = await FilesetResolver.forVisionTasks('/wasm');
        } catch {
          vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
        }
        return await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/selfie_segmenter.tflite',
            delegate: 'CPU',
          },
          runningMode: 'IMAGE',
          outputCategoryMask: true,
          outputConfidenceMasks: false,
        });
      } catch (e2) {
        console.error('AI segmenter could not load', e2);
        return null;
      }
    }
  })();
  return segmenterPromise;
}

export function clearAiCache() {
  aiCache.clear();
}

/**
 * Apply AI background effect to an image element or canvas.
 * @param {HTMLImageElement|HTMLCanvasElement} img
 * @param {string} mode - 'none' | 'cutout' | 'blur' | 'pastel'
 * @param {string} cacheKey - optional cache key (e.g. dataURL)
 * @returns {Promise<HTMLCanvasElement|HTMLImageElement>}
 */
export async function applyAiBackground(img, mode = 'none', cacheKey = '') {
  if (!mode || mode === 'none' || !img) {
    return img;
  }

  const key = cacheKey ? `${cacheKey}_${mode}` : '';
  if (key && aiCache.has(key)) {
    return aiCache.get(key);
  }

  try {
    const segmenter = await getSegmenter();
    if (!segmenter) return img;

    const w = img.width || img.naturalWidth || 640;
    const h = img.height || img.naturalHeight || 480;

    // Run inference
    const result = segmenter.segment(img);
    const mask = result.categoryMask;
    if (!mask) return img;

    const maskArray = mask.getAsUint8Array();
    const mw = mask.width;
    const mh = mask.height;

    // Output canvas
    const outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h;
    const outCtx = outCanvas.getContext('2d');

    // Background drawing
    if (mode === 'blur') {
      outCtx.save();
      outCtx.filter = 'blur(18px)';
      outCtx.drawImage(img, -20, -20, w + 40, h + 40);
      outCtx.restore();
    } else if (mode === 'pastel') {
      const grad = outCtx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#ffd1dc'); // pastel pink
      grad.addColorStop(0.5, '#e0c3fc'); // pastel lavender
      grad.addColorStop(1, '#8ec5fc'); // pastel blue
      outCtx.fillStyle = grad;
      outCtx.fillRect(0, 0, w, h);
    } else if (mode === 'cutout') {
      // Clean white or transparent background
      outCtx.fillStyle = '#ffffff';
      outCtx.fillRect(0, 0, w, h);
    }

    // Cutout foreground
    const fgCanvas = document.createElement('canvas');
    fgCanvas.width = w;
    fgCanvas.height = h;
    const fgCtx = fgCanvas.getContext('2d');
    fgCtx.drawImage(img, 0, 0, w, h);

    const imgData = fgCtx.getImageData(0, 0, w, h);
    const d = imgData.data;

    const sx = mw / w;
    const sy = mh / h;

    for (let y = 0; y < h; y++) {
      const my = Math.floor(y * sy);
      const rowOffset = my * mw;
      const imgRowOffset = y * w * 4;
      for (let x = 0; x < w; x++) {
        const mx = Math.floor(x * sx);
        const maskVal = maskArray[rowOffset + mx];
        const pixelIdx = imgRowOffset + x * 4;
        // In selfie segmenter categoryMask: 0 is background, > 0 is person
        if (maskVal === 0) {
          d[pixelIdx + 3] = 0; // alpha = 0
        }
      }
    }
    fgCtx.putImageData(imgData, 0, 0);

    // Composite foreground onto output
    outCtx.drawImage(fgCanvas, 0, 0);

    if (key) {
      aiCache.set(key, outCanvas);
    }
    return outCanvas;
  } catch (err) {
    console.error('Error in applyAiBackground:', err);
    return img;
  }
}
