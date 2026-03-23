import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Replace this with your actual Firebase config object from your console
const firebaseConfig = {
  apiKey: "AIzaSyDlWO9Istis4r0HGg3OkEJ3kapXYshyeIQ",
  authDomain: "paisa-react.firebaseapp.com",
  projectId: "paisa-react",
  storageBucket: "paisa-react.firebasestorage.app",
  messagingSenderId: "437629919933",
  appId: "1:437629919933:web:dd68ff0c256ef8cd2bcdd4"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();

export const loginWithGoogle = () => signInWithPopup(auth, provider);
export const logout = () => signOut(auth);