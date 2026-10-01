const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

function createPredictHandler({ request, url, timeout = 15000 }) {
  return async (req, res) => {
    const image = req.body && req.body.image;
    if (typeof image !== 'string' || !image) {
      return res.status(400).json({ error: 'A base64 image is required.' });
    }
    const encoded = image.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
    if (encoded.length > 4 * Math.ceil(MAX_IMAGE_BYTES / 3)) {
      return res.status(413).json({ error: 'Image exceeds the 3 MiB limit.' });
    }
    if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      return res.status(400).json({ error: 'Invalid base64 image.' });
    }
    const payload = Buffer.from(encoded, 'base64');
    if (!payload.length || payload.length > MAX_IMAGE_BYTES || payload.toString('base64') !== encoded) {
      return res.status(400).json({ error: 'Invalid base64 image.' });
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Invalid URL');
    } catch {
      return res.status(503).json({ error: 'Inference service is not configured.' });
    }
    try {
      const response = await request({
        method: 'post', url, timeout,
        maxRedirects: 0,
        headers: { 'Content-Type': 'application/x-image' },
        data: payload,
      });
      if (!response || response.data === undefined || response.data === null) {
        return res.status(502).json({ error: 'Inference service returned no result.' });
      }
      return res.json({ message: response.data });
    } catch (error) {
      const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
      return res.status(isTimeout ? 504 : 502).json({ error: 'Inference service is unavailable.' });
    }
  };
}

module.exports = { createPredictHandler, MAX_IMAGE_BYTES };
