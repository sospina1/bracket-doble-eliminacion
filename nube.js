/*
 * Conexión con Firebase: el torneo se guarda en Firestore y solo el
 * administrador (sesión iniciada con su correo) puede modificarlo.
 * La protección real la dan las reglas de seguridad de Firestore.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const config = window.FIREBASE_CONFIG;

if (config && config.apiKey && window.BracketApp) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const ref = doc(db, "torneos", "principal");

  window.BracketApp.connect({
    adminUid: window.ADMIN_UID || "",
    onTournament(cb) {
      return onSnapshot(ref,
        (snap) => {
          if (!snap.exists()) return cb(null);
          try { cb(JSON.parse(snap.data().data)); } catch (e) { cb(null, e); }
        },
        (err) => cb(undefined, err));
    },
    onAuth(cb) { return onAuthStateChanged(auth, cb); },
    login(email, password) { return signInWithEmailAndPassword(auth, email, password); },
    logout() { return signOut(auth); },
    save(t) { return setDoc(ref, { data: JSON.stringify(t), updatedAt: serverTimestamp() }); }
  });
}
