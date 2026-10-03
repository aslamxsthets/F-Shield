import React, { useEffect, useRef, useState } from 'react';
import { api, AuthResponse } from '../services/api';
import { User } from '../types';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: { theme: string; size: string; width: number; text: string }) => void;
        };
      };
    };
  }
}

interface LoginPageProps {
  onAuthenticated: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [setup, setSetup] = useState<AuthResponse | null>(null);
  const [needsTotp, setNeedsTotp] = useState(false);
  const [googleCredential, setGoogleCredential] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  const acceptAuthResult = (result: AuthResponse) => {
    if (result.requires_totp_setup) {
      setSetup(result);
      setNeedsTotp(false);
      setOtp('');
      return;
    }
    if (result.requires_totp) {
      setNeedsTotp(true);
      return;
    }
    if (result.user) onAuthenticated(result.user);
  };

  const handleGoogleCredential = async (credential: string) => {
    setError('');
    setIsSubmitting(true);
    setGoogleCredential(credential);
    try {
      acceptAuthResult(await api.loginWithGoogle(credential, otp || undefined));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!window.google || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => void handleGoogleCredential(response.credential),
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
      });
    };
    document.head.appendChild(script);
    return () => script.remove();
  }, [googleClientId]);

  const handleSubmit = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      if (setup?.setup_id) {
        const result = await api.completeTotpSetup(setup.setup_id, otp);
        onAuthenticated(result.user);
      } else if (needsTotp && googleCredential) {
        acceptAuthResult(await api.loginWithGoogle(googleCredential, otp));
      } else if (mode === 'register') {
        acceptAuthResult(await api.register({ name, username, email, phone, password }));
      } else {
        acceptAuthResult(await api.login(identifier, password, otp || undefined));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed,_#f5f5f4_40%,_#e7e5e4)] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-2xl backdrop-blur">
        <div className="mb-6">
          <div className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700">F-Shield Access</div>
          <h1 className="mt-4 text-2xl font-black text-stone-900">{setup ? 'Set up your authenticator' : mode === 'register' ? 'Create your account' : 'Secure analyst login'}</h1>
          <p className="mt-2 text-sm text-stone-600">
            {setup ? 'Add this account to Google Authenticator, then enter its current code to activate two-step verification.' : 'Sign in with your username, email, or phone number and password.'}
          </p>
        </div>

        {!setup && !needsTotp && (
          <div className="mb-4 grid grid-cols-2 rounded-xl border border-stone-200 bg-stone-100 p-1">
            <button type="button" onClick={() => { setMode('login'); setError(''); }} className={`rounded-lg px-3 py-2 text-sm font-bold ${mode === 'login' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>Sign in</button>
            <button type="button" onClick={() => { setMode('register'); setError(''); }} className={`rounded-lg px-3 py-2 text-sm font-bold ${mode === 'register' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>Create account</button>
          </div>
        )}

        <div className="space-y-4">
          {setup && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">One-time Google Authenticator key</div>
              <div className="mt-2 break-all font-mono text-sm text-stone-800">{setup.setup_secret}</div>
              <a href={setup.otpauth_url} className="mt-2 inline-block text-xs font-bold text-amber-800 underline">Open authenticator app</a>
            </div>
          )}

          {!setup && mode === 'register' && (
            <>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Full name" className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" />
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="Username" className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="Gmail or email address" className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="tel" placeholder="Phone number, including country code" className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </>
          )}

          {!setup && !needsTotp && mode === 'login' && (
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" placeholder="Username, email, or phone number" className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" />
          )}

          {!setup && !needsTotp && (
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder="Password (12 characters minimum)" className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" />
          )}

          {(setup || needsTotp) && (
            <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit authenticator code" className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-lg font-mono tracking-[0.35em] focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" />
          )}

          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</div>}

          <button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting} className="w-full rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? 'Verifying...' : setup ? 'Activate authenticator and sign in' : needsTotp ? 'Verify and sign in' : mode === 'register' ? 'Create account and enroll authenticator' : 'Continue with password'}
          </button>

          {!setup && !needsTotp && mode === 'login' && (
            <>
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400"><span className="h-px flex-1 bg-stone-200" />or<span className="h-px flex-1 bg-stone-200" /></div>
              {googleClientId ? <div ref={googleButtonRef} className="flex min-h-10 justify-center" /> : <button type="button" disabled title="Configure VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID" className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-bold text-stone-400">Continue with Google (not configured)</button>}
            </>
          )}

          {setup && <button type="button" onClick={() => { setSetup(null); setOtp(''); setError(''); }} className="w-full text-xs font-semibold text-stone-500 hover:text-stone-900">Start over</button>}
        </div>
      </div>
    </div>
  );
};