import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import App from './App';
import LoginPage from './LoginPage';
import MeshBackground from './MeshBackground';
import { authConfigured, supabase } from './supabase';

export default function Experience() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (!supabase) {
      setInitializing(false);
      return;
    }
    const client = supabase;
    let disposed = false;
    let sequence = 0;

    const verifyUser = () => {
      const current = ++sequence;
      void client.auth.getUser().then(({ data, error }) => {
        if (disposed || current !== sequence) return;
        setUser(error ? null : data.user);
        setInitializing(false);
      }).catch(() => {
        if (disposed || current !== sequence) return;
        setUser(null);
        setInitializing(false);
      });
    };

    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
        setUser(null);
        setInitializing(false);
      } else if (event === 'SIGNED_OUT' || !session) {
        ++sequence;
        setUser(null);
        setInitializing(false);
      } else {
        // Validate with Supabase Auth; never grant access from sessionStorage alone.
        verifyUser();
      }
    });

    verifyUser();
    return () => { disposed = true; subscription.unsubscribe(); };
  }, []);

  const toggleMotion = () => setMotionEnabled(enabled => !enabled);

  async function signIn(email: string, password: string) {
    if (!supabase) throw new Error('Authentication is not configured.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const { data, error: verificationError } = await supabase.auth.getUser();
    if (verificationError || !data.user) {
      throw new Error('Could not verify the account.');
    }
    setUser(data.user);
  }

  async function requestReset(email: string) {
    if (!supabase) throw new Error('Authentication is not configured.');
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }

  async function updatePassword(password: string) {
    if (!supabase) throw new Error('Authentication is not configured.');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    await supabase.auth.signOut();
    setRecoveryMode(false);
    setUser(null);
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
  }

  return (
    <>
      <MeshBackground paused={!motionEnabled} />
      {initializing ? (
        <main className="auth-loading" role="status">Loading…</main>
      ) : user && !recoveryMode ? (
        <App
          userEmail={user.email || ''}
          motionEnabled={motionEnabled}
          onMotionChange={toggleMotion}
          onExit={signOut}
        />
      ) : (
        <LoginPage
          configured={authConfigured}
          recoveryMode={recoveryMode}
          onSignIn={signIn}
          onRequestReset={requestReset}
          onUpdatePassword={updatePassword}
        />
      )}
    </>
  );
}
