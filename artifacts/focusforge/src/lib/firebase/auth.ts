import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  GoogleAuthProvider
} from 'firebase/auth';
import { auth, googleProvider } from './config';
import { useState, useEffect } from 'react';

// Configure Google provider once at module level
googleProvider.addScope?.('https://www.googleapis.com/auth/calendar.events');

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, loading };
}

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    
    // Save the OAuth access token to use with Google Calendar API
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      localStorage.setItem('google_calendar_token', credential.accessToken);
    }
    
    return { user: result.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
};

export const logout = async () => {
  try {
    // Clear sensitive tokens before signing out
    localStorage.removeItem('google_calendar_token');
    localStorage.removeItem('focusforge-settings');
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
  }
};
