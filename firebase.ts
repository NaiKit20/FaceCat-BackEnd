import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBodI28POjc6bNxhd-l978DNviac0pwTGo",
  authDomain: "facecat-react.firebaseapp.com",
  projectId: "facecat-react",
  storageBucket: "facecat-react.appspot.com",
  messagingSenderId: "178841898055",
  appId: "1:178841898055:web:74253150dd134092b93562",
  measurementId: "G-3W0V8GMQ8D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const storage = getStorage(app)