import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';

type Props = {
  configured: boolean;
  recoveryMode: boolean;
  onSignIn: (email: string, password: string) => Promise<void>;
  onRequestReset: (email: string) => Promise<void>;
  onUpdatePassword: (password: string) => Promise<void>;
};

export default function LoginPage({
  configured, recoveryMode, onSignIn, onRequestReset, onUpdatePassword,
}: Props) {
  const [view, setView] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const forgot = !recoveryMode && view === 'forgot';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (recoveryMode) {
        if (password.length < 8) throw new Error('Use at least 8 characters.');
        await onUpdatePassword(password);
        setNotice('Password changed. You can sign in now.');
        setPassword('');
      } else if (forgot) {
        await onRequestReset(email.trim());
        setNotice('If that address has an account, a reset link will be sent.');
      } else {
        await onSignIn(email.trim(), password);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const heading = recoveryMode ? 'Set new password' : forgot ? 'Reset password' : 'Sign in';
  return (
    <main className="auth-page">
      <section className="auth-brand" aria-label="About Halo">
        <div className="auth-brand-name">halo<span>.</span></div>
        <p>Proximity safety and incident management.</p>
      </section>

      <section className="auth-card" aria-labelledby="auth-heading">
        <div className="auth-card-title">
          <h1 id="auth-heading">{heading}</h1>
          <p>{recoveryMode ? 'Choose a new password for your account.' :
              forgot ? 'We will email you a password reset link.' :
              'Welcome to Halo.'}</p>
        </div>

        <form onSubmit={(event) => { void submit(event); }}>
          {!recoveryMode && (
            <div className="auth-field">
              <label htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={!configured || busy}
              />
            </div>
          )}

          {!forgot && (
            <div className="auth-field">
              <label htmlFor="auth-password">{recoveryMode ? 'New password' : 'Password'}</label>
              <div className="auth-password-wrap">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={recoveryMode ? 'new-password' : 'current-password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  minLength={recoveryMode ? 8 : undefined}
                  required
                  disabled={!configured || busy}
                />
                <button
                  type="button"
                  className="auth-eye"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(v => !v)}
                >
                  {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                </button>
              </div>
            </div>
          )}

          {!recoveryMode && !forgot && (
            <button className="auth-forgot-link" type="button" onClick={() => { setView('forgot'); setError(''); setNotice(''); }}>
              Forgot password?
            </button>
          )}

          {error && <p className="auth-error" role="alert">{error}</p>}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          {!configured && (
            <p className="auth-error" role="alert">
              Sign-in is not configured yet. Contact the Halo administrator.
            </p>
          )}

          <button className="auth-submit" type="submit" disabled={!configured || busy}>
            {busy ? 'Please wait…' : recoveryMode ? 'Save password' : forgot ? 'Send reset link' : 'Sign in'}
            <ArrowRight size={18}/>
          </button>
          {forgot && (
            <button className="auth-back" type="button" onClick={() => { setView('login'); setError(''); setNotice(''); }}>
              Back to sign in
            </button>
          )}
        </form>
      </section>
    </main>
  );
}
