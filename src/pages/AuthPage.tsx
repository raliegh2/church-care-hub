import { useState, type FormEvent } from 'react';
import { Brand } from '../components/Brand';
import { supabase } from '../lib/supabase';

export function AuthPage() {
  const [signup,setSignup]=useState(false); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setMessage('');const f=new FormData(e.currentTarget);const email=String(f.get('email'));const password=String(f.get('password'));const name=String(f.get('name')||'');
    const { error } = signup ? await supabase.auth.signUp({email,password,options:{data:{display_name:name}}}) : await supabase.auth.signInWithPassword({email,password});
    if(error)setMessage(error.message); else if(signup)setMessage('Account created. Continue by signing in with the same email and password.'); setBusy(false);
  }
  return <main className="auth-layout"><section className="auth-panel"><div className="auth-card"><Brand/><h1>{signup?'Create your account':'Welcome back'}</h1><p>{signup?'Join your church care team.':'Sign in to your role-based workspace.'}</p>{message&&<div className="notice">{message}</div>}<form onSubmit={submit}>{signup&&<label>Full name<input name="name" required/></label>}<label>Email<input name="email" type="email" autoComplete="email" required/></label><label>Password<input name="password" type="password" minLength={6} autoComplete={signup?'new-password':'current-password'} required/></label><button className="primary" disabled={busy}>{busy?'Please wait…':signup?'Create account':'Sign in'}</button></form><button className="text-btn" onClick={()=>{setSignup(!signup);setMessage('')}}>{signup?'Already have an account? Sign in':'Need an account? Sign up'}</button></div></section><section className="auth-visual"><div><h2>Welcome every person.<br/>Track every follow-up.<br/>Support every need.</h2><p>Secure ministry care for ushers, pastors and administrators.</p></div></section></main>
}
