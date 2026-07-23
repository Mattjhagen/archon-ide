import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowRight, Github, LockKeyhole, Mail, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  const signInWithGithub = async () => {
    setMessage('');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: window.location.origin } });
    if (error) setMessage(error.message);
  };

  const sendMagicLink = async () => {
    setMessage('');
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setMessage(error ? error.message : 'Check your inbox for a secure sign-in link.');
  };

  if (loading) return <div className="auth-loading"><div className="brand-mark"><Sparkles size={17} /></div></div>;
  if (session) return <>{children}</>;

  return (
    <main className="auth-shell">
      <div className="setup-glow" />
      <header className="setup-header"><div className="brand-mark"><Sparkles size={17} /></div><div><strong>ARCHON</strong><span>YOUR CODE. YOUR MODELS.</span></div></header>
      <section className="auth-card">
        <div className="setup-kicker">PRIVATE WORKSPACE</div>
        <h1>Build without boundaries.</h1>
        <p>Sign in to launch an isolated coding environment that belongs only to you.</p>
        <button className="github-auth" onClick={signInWithGithub}><Github size={17} /> Continue with GitHub <ArrowRight size={15} /></button>
        <div className="auth-divider"><span>or use a secure email link</span></div>
        <label><span><Mail size={13} /> Email address</span><div><input type="email" value={email} onChange={event => setEmail(event.target.value)} onKeyDown={event => event.key === 'Enter' && email && sendMagicLink()} placeholder="you@company.com" /><button onClick={sendMagicLink} disabled={!email}>Send link</button></div></label>
        {message && <div className="auth-message">{message}</div>}
        <div className="privacy-note"><LockKeyhole size={14} /><span>Authentication by Supabase. Workspace access is scoped to your identity.</span></div>
      </section>
    </main>
  );
}
