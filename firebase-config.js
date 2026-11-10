/*
 * Configuración de Firebase (Consola de Firebase > Configuración del proyecto > Tus apps).
 * Estos datos son públicos por diseño: la seguridad la dan las reglas de Firestore.
 * Si FIREBASE_CONFIG es null, la página funciona en modo local (cada quien su torneo).
 */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCjxN-yJLoeuglsp2jQ5FGtBka5V_ePHNo",
  authDomain: "bracket-doble-eliminacion.firebaseapp.com",
  projectId: "bracket-doble-eliminacion",
  storageBucket: "bracket-doble-eliminacion.firebasestorage.app",
  messagingSenderId: "88040259792",
  appId: "1:88040259792:web:6016b5b51cf89bc9185ed5"
};

// UID del usuario administrador (Firebase > Authentication > Usuarios)
window.ADMIN_UID = "yIe3VwwTgvMF7l6DGpOFFu19qtm1";
