// Attachments (photos, PDFs) kept on the device in IndexedDB; localStorage is too small for them.
(function () {
  const db = new Promise((ok, fail) => {
    const r = indexedDB.open('csc-files', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error);
  });
  const tx = async (mode, fn) => { const d = await db; return new Promise((ok, fail) => {
    const t = d.transaction('files', mode), req = fn(t.objectStore('files'));
    t.oncomplete = () => ok(req && req.result); t.onerror = () => fail(t.error); }); };

  // Photos are shrunk to 1600px JPEG so a few dozen fit comfortably.
  async function shrink(file) {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
    const img = await createImageBitmap(file).catch(() => null); if (!img) return file;
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return new Promise(ok => c.toBlob(b => ok(b || file), 'image/jpeg', .82));
  }

  async function save(file) {
    const blob = await shrink(file), id = 'f' + Date.now() + Math.random().toString(36).slice(2, 6);
    await tx('readwrite', s => s.put(blob, id));
    return { id, name: file.name, type: blob.type || file.type };
  }
  const get = id => tx('readonly', s => s.get(id));
  const remove = id => id ? tx('readwrite', s => s.delete(id)).catch(() => {}) : Promise.resolve();

  window.Files = { save, get, remove };
})();
