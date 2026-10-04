import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCNqVLwCUUXciV-b2ogHPBO28yugDWOOQg",
  authDomain: "ai-finance-os-63384.firebaseapp.com",
  projectId: "ai-finance-os-63384",
  storageBucket: "ai-finance-os-63384.firebasestorage.app",
  messagingSenderId: "964909822507",
  appId: "1:964909822507:web:6cce8c416934d64776706e",
  measurementId: "G-E5BTF50PVF",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export { app };
