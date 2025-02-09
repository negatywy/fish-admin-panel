import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDL2ddmW4clg9Rk8pbpDTJZKY5k8-4th2I",
  authDomain: "fish-db-dummy.firebaseapp.com",
  projectId: "fish-db-dummy",
  storageBucket: "fish-db-dummy.firebasestorage.app",
  messagingSenderId: "202859054752",
  appId: "1:202859054752:web:e74917a24c6eae2f30ebc5",
  measurementId: "G-G4WJPZ8PPR"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);