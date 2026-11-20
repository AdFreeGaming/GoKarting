'use strict';
/* ---------------------------------------------------------------- saved sessions
   Stored in the browser's IndexedDB (database "kart-enduro", store "saves"), so progress survives closing the tab.
   Falls back to localStorage if IndexedDB is unavailable. Nothing leaves the player's machine. */
const Store = (() => {
  const DB = 'kart-enduro', ST = 'saves', LS = 'kart-enduro-saves';
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('no indexedDB'));
    const rq = indexedDB.open(DB, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore(ST, { keyPath: 'id' });
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
  }));
  const tx = (mode, fn) => open().then(db => new Promise((res, rej) => {
    const t = db.transaction(ST, mode), rq = fn(t.objectStore(ST));
    t.oncomplete = () => res(rq.result); t.onerror = t.onabort = () => rej(t.error);
  }));
  const ls = {
    all() { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch (e) { return []; } },
    write(a) { localStorage.setItem(LS, JSON.stringify(a)); }
  };
  return {
    newId: () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    put(rec) {
      return tx('readwrite', s => s.put(rec)).catch(() => { const a = ls.all().filter(r => r.id !== rec.id); a.push(rec); ls.write(a); }).then(() => rec.id);
    },
    list() { return tx('readonly', s => s.getAll()).catch(() => ls.all()).then(a => a.sort((p, q) => q.saved - p.saved)); },
    remove(id) { return tx('readwrite', s => s.delete(id)).catch(() => ls.write(ls.all().filter(r => r.id !== id))); }
  };
})();
