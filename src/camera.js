// Camera access & frame capture

export async function getCamera(withAudio = true) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocam');
  const video = { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } };
  if (withAudio) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video,
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      /* fall back to video only */
    }
  }
  return navigator.mediaDevices.getUserMedia({ video, audio: false });
}

export function stopStream(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Grab a mirrored (selfie-style) JPEG from a playing <video>. */
export function captureFrame(videoEl, maxW = 640, quality = 0.8) {
  const vw = videoEl?.videoWidth || 640;
  const vh = videoEl?.videoHeight || 480;
  const scale = Math.min(1, maxW / vw);
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  try {
    if (videoEl && videoEl.readyState >= 2) {
      ctx.drawImage(videoEl, 0, 0, w, h);
    } else {
      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, w, h);
    }
  } catch {
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, w, h);
  }
  return c.toDataURL('image/jpeg', quality);
}
