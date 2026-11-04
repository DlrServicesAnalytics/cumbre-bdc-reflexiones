// Capa de datos: Firebase Firestore (producción) o localStorage (modo demostración).
import { FIREBASE_CONFIG } from "./config.js";

export const MODE = FIREBASE_CONFIG && FIREBASE_CONFIG.projectId ? "firebase" : "demo";
let api = null;

export async function store() {
  if (api) return api;
  if (MODE === "demo") {
    const KEY = "cumbre_demo_respuestas";
    const bc = "BroadcastChannel" in window ? new BroadcastChannel("cumbre_demo") : null;
    const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } };
    const subs = new Set();
    const emit = () => { const d = read().slice().reverse(); subs.forEach(f => f(d)); };
    if (bc) bc.onmessage = emit;
    window.addEventListener("storage", e => { if (e.key === KEY) emit(); });
    api = {
      async add(text) {
        const d = read();
        d.push({ text, id: Math.random().toString(36).slice(2), ts: Date.now() });
        try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
        if (bc) bc.postMessage(1);
        emit();
      },
      listen(f) { subs.add(f); emit(); return () => subs.delete(f); }
    };
    return api;
  }
  const appMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const fs = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const app = appMod.initializeApp(FIREBASE_CONFIG);
  const db = fs.getFirestore(app);
  const col = fs.collection(db, "respuestas");
  api = {
    async add(text) { await fs.addDoc(col, { text, ts: fs.serverTimestamp() }); },
    listen(f, onErr) {
      const q = fs.query(col, fs.orderBy("ts", "desc"), fs.limit(3000));
      return fs.onSnapshot(q, s => {
        f(s.docs.map(d => { const x = d.data(); return { text: x.text, id: d.id, ts: x.ts ? x.ts.toMillis() : Date.now() }; }));
      }, onErr);
    }
  };
  return api;
}
