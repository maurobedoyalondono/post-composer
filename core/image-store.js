// core/image-store.js
const DB_NAME    = 'pc_images_db';
const DB_VERSION = 1;
const STORE_NAME = 'images';

let _dbPromise = null;

function _open() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: ['briefId', 'filename'] });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => { _dbPromise = null; reject(e.target.error); };
  });
  return _dbPromise;
}

export const imageStore = {
  /**
   * Upsert one or more images for a brief.
   * @param {string} briefId
   * @param {{ [filename: string]: string }} imageMap  filename → dataUrl
   * @returns {Promise<void>}
   */
  async save(briefId, imageMap) {
    const db = await _open();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const [filename, dataUrl] of Object.entries(imageMap)) {
        store.put({ briefId, filename, dataUrl });
      }
      tx.oncomplete = () => resolve();
      tx.onerror    = e => reject(e.target.error);
      tx.onabort    = e => reject(e.target.error);
    });
  },

  /**
   * Load all images for a brief.
   * @param {string} briefId
   * @returns {Promise<{ [filename: string]: string }>}
   */
  async load(briefId) {
    const db = await _open();
    return new Promise((resolve, reject) => {
      const tx     = db.transaction(STORE_NAME, 'readonly');
      const store  = tx.objectStore(STORE_NAME);
      const range  = IDBKeyRange.bound([briefId, ''], [briefId, '\uffff']);
      const result = {};
      const req    = store.openCursor(range);
      req.onsuccess = e => {
        const cursor = e.target.result;
        if (cursor) {
          result[cursor.value.filename] = cursor.value.dataUrl;
          cursor.continue();
        } else {
          resolve(result);
        }
      };
      req.onerror = e => reject(e.target.error);
    });
  },

  /**
   * Delete all images for a brief.
   * @param {string} briefId
   * @returns {Promise<void>}
   */
  async delete(briefId) {
    const db = await _open();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const range = IDBKeyRange.bound([briefId, ''], [briefId, '\uffff']);
      store.delete(range);
      tx.oncomplete = () => resolve();
      tx.onerror    = e => reject(e.target.error);
      tx.onabort    = e => reject(e.target.error);
    });
  },
};
