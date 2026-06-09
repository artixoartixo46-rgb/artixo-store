import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDB9I_IbTXmsf8nuE4DsPwHX9nHDpInXLs",
  authDomain: "artixo-website.firebaseapp.com",
  projectId: "artixo-website",
  storageBucket: "artixo-website.firebasestorage.app",
  messagingSenderId: "215425965413",
  appId: "1:215425965413:web:c6411cf48be4c17b57158c",
  measurementId: "G-V7F8NTZBR4",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
