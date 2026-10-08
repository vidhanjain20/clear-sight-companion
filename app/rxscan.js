// Prescription scanning: OCR a photo in the browser (Tesseract.js, loaded only when used), then pull out
// sphere / cylinder / axis for each eye, the reading addition and the date. The person always checks the result.
(function (root) {
  // Signed decimals like -2.75, +0.50, 2,25 (OCR sometimes reads the minus as a dash or tilde), "plano"/"DS" as 0.
  const NUM = /(plano|pl\b|[+\-−–—~]?\s?\d{1,2}[.,]\d{2}|[+\-−–—~]\s?\d{3,4}\b|\b\d{1,3}\b)/gi;
  const EYE = [['re', /^\s*(r|re|r\.e\.?|right|od)\b[\s:.)]*/i], ['le', /^\s*(l|le|l\.e\.?|left|os)\b[\s:.)]*/i]];

  const toNum = t => {
    t = t.replace(/\s/g, '').replace(/[−–—~]/, '-').replace(',', '.');
    if (/^[+-]\d{3,4}$/.test(t)) t = t.slice(0, -2) + '.' + t.slice(-2);   // OCR dropped the point: -250 → -2.50
    return /^pl/i.test(t) ? '0.00' : t;
  };

  function parseRxText(text) {
    const lines = text.split(/\r?\n/).map(l => l.replace(/[|\[\]{}]/g, ' ').trim()).filter(Boolean);
    const rx = { re: { sph: '', cyl: '', axis: '' }, le: { sph: '', cyl: '', axis: '' }, add: '', date: '', check: [] };
    for (const line of lines) {
      for (const [eye, re] of EYE) {
        const m = line.match(re); if (!m || rx[eye].sph) continue;
        const nums = (line.slice(m[0].length).match(NUM) || []).map(toNum);
        const dec = nums.filter(n => /\./.test(n));                       // sph, cyl (and maybe add)
        const axis = nums.find(n => /^\d{1,3}$/.test(n) && +n <= 180);    // whole number 0–180
        if (!dec.length) continue;
        rx[eye].sph = dec[0]; rx[eye].cyl = dec[1] && dec[1] !== '0.00' ? dec[1] : '';
        if (rx[eye].cyl && axis) rx[eye].axis = axis;
        if (dec[2] && !rx.add && +dec[2] > 0) rx.add = dec[2].replace(/^\+/, '');
      }
      const add = line.match(/\badd(?:ition)?\b[^\d+\-]*([+]?\d[.,]\d{2}|\+\d{3}\b)/i);
      if (add && !rx.add) rx.add = toNum(add[1]).replace(/^\+/, '');
      const d = line.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
      if (d && !rx.date) { const y = d[3].length === 2 ? '20' + d[3] : d[3]; rx.date = `${y}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}`; }
    }
    // Never guess a missing + or − (it would flip short- and long-sightedness): keep the number and flag it.
    rx.check = [];
    for (const k of ['re', 'le']) for (const f of ['sph', 'cyl']) { const v = rx[k][f]; if (v && !/^[+-]/.test(v) && +v !== 0) rx.check.push(`${k}_${f}`); }
    // A misread date (impossible, in the future, or implausibly old) is left for the person to enter.
    const dt = new Date(rx.date);
    if (rx.date && (isNaN(dt) || dt > new Date() || dt.getFullYear() < 1990)) rx.date = '';
    return rx.re.sph || rx.le.sph ? rx : null;
  }

  let T;
  const loadTesseract = () => T || (T = new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = () => ok(window.Tesseract); s.onerror = () => { T = null; fail(new Error('Could not load the scanner')); };
    document.head.appendChild(s);
  }));

  // Photo → canvas the OCR reads well. 'adaptive': black-and-white judged against each pixel's surroundings
  // (Bradley threshold), so shadows and uneven light don't swallow the text, then table lines are wiped.
  // 'grey': plain greyscale, letting the OCR binarise it itself (the fallback).
  async function prepare(file, mode = 'adaptive') {
    const img = await createImageBitmap(file, { imageOrientation: 'from-image' });   // phones store portrait photos sideways
    const k = Math.min(3, 2600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    const W = c.width = Math.round(img.width * k), H = c.height = Math.round(img.height * k);
    const g = c.getContext('2d', { willReadFrequently: true }); g.filter = 'grayscale(1)'; g.drawImage(img, 0, 0, W, H);
    if (mode === 'grey') return c;
    const im = g.getImageData(0, 0, W, H), px = im.data;
    // Integral image of brightness → mean of any window in O(1).
    const sum = new Float64Array((W + 1) * (H + 1));
    for (let y = 1; y <= H; y++) for (let x = 1, row = 0; x <= W; x++) { row += px[((y - 1) * W + x - 1) * 4]; sum[y * (W + 1) + x] = sum[(y - 1) * (W + 1) + x] + row; }
    const r = Math.max(8, Math.round(Math.max(W, H) / 40)), T = 0.15, dark = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(W, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(H, y + r + 1);
      const mean = (sum[y1 * (W + 1) + x1] - sum[y0 * (W + 1) + x1] - sum[y1 * (W + 1) + x0] + sum[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0));
      dark[y * W + x] = px[(y * W + x) * 4] < mean * (1 - T) ? 1 : 0;
    }
    // Remove ink that can't be a character, whatever the tilt: table grids, page edges and shadow borders are
    // long, thin or sprawling connected shapes; digits and letters are small, compact ones.
    const L = Math.max(W, H), lab = new Int32Array(W * H), stack = new Int32Array(W * H);
    let n = 0;
    for (let i = 0; i < W * H; i++) {
      if (!dark[i] || lab[i]) continue;
      n++; let top = 0, count = 0, x0 = W, x1 = 0, y0 = H, y1 = 0; stack[top++] = i; lab[i] = n;
      while (top) {
        const j = stack[--top], x = j % W, y = (j - x) / W; count++;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const k of [j - 1, j + 1, j - W, j + W]) if (k >= 0 && k < W * H && dark[k] && !lab[k] && Math.abs((k % W) - x) <= 1) { lab[k] = n; stack[top++] = k; }
      }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, len = Math.max(bw, bh), thin = Math.min(bw, bh), fill = count / (bw * bh);
      const junk = len > 0.3 * L || (len > 0.035 * L && (fill < 0.12 || len / thin > 12)) || count < 4;
      if (junk) { const q = [i]; lab[i] = -1; while (q.length) { const j = q.pop(), x = j % W;          // mark this shape for removal
        for (const k of [j - 1, j + 1, j - W, j + W]) if (k >= 0 && k < W * H && lab[k] === n && Math.abs((k % W) - x) <= 1) { lab[k] = -1; q.push(k); } } }
    }
    for (let i = 0; i < W * H; i++) { const v = dark[i] && lab[i] > 0 ? 0 : 255; px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v; px[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0);
    return c;
  }

  // How complete a parse is: both eyes' sphere matter most.
  const filled = rx => rx ? ['re', 'le'].reduce((n, e) => n + (rx[e].sph ? 3 : 0) + (rx[e].cyl ? 1 : 0) + (rx[e].axis ? 1 : 0), 0) + (rx.date ? 1 : 0) - rx.check.length : -1;

  let worker;
  async function scan(file, onProgress = () => {}) {
    const Tesseract = await loadTesseract();
    worker ||= Tesseract.createWorker('eng', 1, { logger: m => m.status === 'recognizing text' && onProgress(m.progress) })
      .then(async w => { await w.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' }); return w; });
    const w = await worker;
    let best = null;
    for (const mode of ['adaptive', 'grey']) {                 // second pass only if the first didn't find both eyes
      const { data } = await w.recognize(await prepare(file, mode));
      const rx = parseRxText(data.text);
      if (!best || filled(rx) > filled(best.rx)) best = { rx, text: data.text, mode };
      if (rx && rx.re.sph && rx.le.sph && !rx.check.length) break;
    }
    return best;
  }

  const api = { parseRxText, scan, prepare };
  if (typeof module !== 'undefined') module.exports = api; else root.RxScan = api;
})(typeof window !== 'undefined' ? window : globalThis);
