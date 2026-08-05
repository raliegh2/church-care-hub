import { useEffect, useState, type FormEvent } from 'react';
import { Brand } from '../components/Brand';
import { Illustration } from '../components/Illustration';
import { secureSignIn, SecureLoginError } from '../lib/secureAuth';
import { canonicalAppOrigin, supabase } from '../lib/supabase';

export function AuthPage() {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds > 0]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || cooldownSeconds > 0) return;

    setMessage('');
    setIsError(false);
    const form = new FormData(e.currentTarget);
    const normalizedEmail = email.trim().toLowerCase();
    const password = String(form.get('password'));
    const name = String(form.get('name') || '').trim();

    if (signup && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) {
      setIsError(true);
      setMessage('Use at least 8 characters with an uppercase letter, lowercase letter, number, and symbol.');
      return;
    }

    setBusy(true);
    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { display_name: name },
            emailRedirectTo: `${canonicalAppOrigin}/`,
          },
        });

        if (error) {
          setIsError(true);
          setMessage(error.status === 429
            ? 'Too many account requests. Please wait before trying again.'
            : 'The account could not be created. Check the details and try again.');
        } else if (!data.session) {
          setMessage('Check your email to confirm your account. If you already registered, use “Forgot password?” instead.');
        }
      } else {
        await secureSignIn(normalizedEmail, password);
      }
    } catch (error) {
      setIsError(true);
      if (error instanceof SecureLoginError) {
        setMessage(error.message);
        if (error.retryAfterSeconds > 0) setCooldownSeconds(error.retryAfterSeconds);
      } else {
        setMessage('Sign-in is temporarily unavailable. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function sendReset() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setIsError(true);
      setMessage('Enter your email address first.');
      return;
    }
    if (busy || cooldownSeconds > 0) return;

    setBusy(true);
    setIsError(false);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${canonicalAppOrigin}/`,
    });
    setBusy(false);

    if (error?.status === 429) {
      setIsError(true);
      setMessage('Too many password-reset requests. Please wait before trying again.');
      return;
    }

    setMessage('If an account exists for that email, a password-reset link is on its way.');
  }

  const locked = busy || cooldownSeconds > 0;
  const submitLabel = cooldownSeconds > 0
    ? `Try again in ${cooldownSeconds}s`
    : busy
      ? 'Please wait…'
      : signup
        ? 'Create account'
        : 'Sign in';

  return (
    <main className="auth-layout">
      <section className="auth-visual">
        <div className="auth-visual-content">
          <Brand subtitle="Care Ministry" />
          <div className="auth-kicker">Care, coordinated</div>
          <div className="auth-artwork"><Illustration name="welcome" /></div>
          <h2>Every person seen.<br />Every need followed.</h2>
          <p>A secure workspace for ushers, pastors and administrators to care for visitors and members with clarity.</p>
          <blockquote>
            <strong>“Bear one another’s burdens.”</strong>
            <span>Galatians 6:2</span>
          </blockquote>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-mobile-brand"><Brand subtitle="Care Ministry" /></div>
            <h1>{signup ? 'Create your account' : 'Welcome back'}</h1>
            <p>{signup ? 'Create an account, then choose the ministry role you serve in.' : 'Sign in to continue caring for your church community.'}</p>
          </div>

          {message && <div className={`notice${isError ? ' error' : ''}`}>{message}</div>}

          <form onSubmit={submit}>
            {signup && (
              <label>
                Full name
                <input name="name" autoComplete="name" placeholder="Your full name" required />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength={signup ? 8 : 6}
                autoComplete={signup ? 'new-password' : 'current-password'}
                placeholder={signup ? 'Create a secure password' : 'Enter your password'}
                required
              />
              {signup && <small>8+ characters with uppercase, lowercase, number and symbol.</small>}
            </label>

            {!signup && (
              <div className="auth-inline-action">
                <span>Secure ministry access</span>
                <button className="text-btn" type="button" disabled={locked} onClick={() => void sendReset()}>
                  Forgot password?
                </button>
              </div>
            )}

            <button className="primary auth-submit" disabled={locked}>{submitLabel}</button>
          </form>

          <div className="auth-switch">
            <span>{signup ? 'Already have an account?' : 'New here?'}</span>
            <button
              className="text-btn"
              disabled={busy}
              onClick={() => {
                setSignup(!signup);
                setMessage('');
                setIsError(false);
                setCooldownSeconds(0);
              }}
            >
              {signup ? 'Sign in' : 'Create an account and choose your role'}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
