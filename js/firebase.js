// Importa os modulos do Firebase usados pelo sistema.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Configuracao do projeto Firebase onde ficam login e banco de dados.
const firebaseConfig = {
  apiKey: "AIzaSyD0LYRObY7WKRbJQfy8Sg36LstnNKz5_pg",
  authDomain: "helpdesk-raageplan.firebaseapp.com",
  projectId: "helpdesk-raageplan",
  storageBucket: "helpdesk-raageplan.firebasestorage.app",
  messagingSenderId: "690785310437",
  appId: "1:690785310437:web:28db2e43794add3bf8e60c",
  measurementId: "G-F2SDRWEZ0L"
};

// Inicializa o Firebase, a autenticacao e o Firestore para outros arquivos usarem.
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Mantem o usuario logado no navegador mesmo quando a pagina e recarregada.
export const persistenceReady = setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn("Nao foi possivel configurar a persistencia local.", error);
});
