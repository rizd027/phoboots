// Live Photo capture & animated strip recording

export function isLivePhotoSupported() {
  return typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined';
}

function getBestMimeType() {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  for (const t of types) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

/**
 * Record a short live clip (~2 seconds) from a MediaStream.
 */
export function recordLiveClip(stream, durationMs = 2400) {
  if (!isLivePhotoSupported() || !stream || !stream.active) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const mimeType = getBestMimeType();
      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const type = mimeType || 'video/webm';
        const blob = new Blob(chunks, { type });
        const url = URL.createObjectURL(blob);
        resolve({ blob, url });
      };

      recorder.onerror = () => resolve(null);

      recorder.start(100);
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, durationMs);
    } catch (err) {
      console.warn('Live photo recording not supported on this device/stream', err);
      resolve(null);
    }
  });
}

/**
 * Record an animated strip canvas into a looping video for download.
 */
export function recordCanvasVideo(canvas, drawFrameFn, durationMs = 4000, fps = 30) {
  if (!isLivePhotoSupported() || !canvas.captureStream) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const stream = canvas.captureStream(fps);
      const mimeType = getBestMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const type = mimeType || 'video/webm';
        const blob = new Blob(chunks, { type });
        resolve(blob);
      };

      recorder.start(100);

      let active = true;
      const start = performance.now();
      function loop(now) {
        if (!active) return;
        drawFrameFn(now - start);
        if (now - start < durationMs) {
          requestAnimationFrame(loop);
        } else {
          active = false;
          if (recorder.state === 'recording') recorder.stop();
        }
      }
      requestAnimationFrame(loop);
    } catch (err) {
      console.error('Canvas video record error', err);
      resolve(null);
    }
  });
}
