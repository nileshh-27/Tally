import React from 'react';
import { useAuth, loginWithGoogle } from '../lib/firebase/auth';

export function AuthLayer({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (!import.meta.env.VITE_FIREBASE_API_KEY) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white p-4">
        <div className="max-w-md w-full space-y-4 p-8 border border-white/10 rounded-xl bg-white/5 backdrop-blur-xl">
          <h2 className="text-2xl font-bold">Firebase Setup Required</h2>
          <p className="text-gray-400">Please provide your Firebase configuration in the `.env` file to continue.</p>
          <pre className="p-4 bg-black/50 rounded text-xs overflow-x-auto text-gray-300">
            VITE_FIREBASE_API_KEY=...{'\n'}
            VITE_FIREBASE_AUTH_DOMAIN=...{'\n'}
            VITE_FIREBASE_PROJECT_ID=...
          </pre>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="animate-pulse">Loading FocusForge...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white p-4">
        <div className="max-w-md w-full space-y-8 p-8 border border-white/10 rounded-xl bg-white/5 backdrop-blur-xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">FocusForge</h2>
            <p className="mt-2 text-sm text-gray-400">
              Sign in to sync your study blocks securely.
            </p>
          </div>
          <button
            onClick={loginWithGoogle}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-black bg-white hover:bg-gray-200 focus:outline-none"
          >
            Sign in with Google
          </button>
          {/* Note: Email/Password UI would go here but is omitted for brevity */}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
