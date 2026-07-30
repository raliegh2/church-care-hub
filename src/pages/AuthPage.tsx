import { useState, type FormEvent } from 'react';
import { Brand } from '../components/Brand';
import { supabase } from '../lib/supabase';

export function AuthPage() {
  const [signup,setSignup]=useState(false);
  const [email,setEmail]=useState('');
  const [message,setMessage]=useState('');
  const [isError,setIsError]=useState(false);
  const [busy,setBusy]=useState(false);

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    setMessage('');
    setIsError(false);
    const f=new FormData(e.currentTarget);
    const normalizedEmail=email.trim().toLowerCase();
    const password=String(f.get('password'));
    const name=String(f.get('name')||'').trim();

    if(signup&&!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)){
      setIsError(true);
      setMessage('Use at least 8 characters with an uppercase letter, lowercase letter, number, and symbol.');
      return;
    }

    setBusy(true);
    if(signup){
      const {data,error}=await supabase.auth.signUp({
        email:normalizedEmail,
        password,
        options:{
          data:{display_name:name},
          emailRedirectTo:`${window.location.origin}/`,
        },
      });
      if(error){
        setIsError(true);
        setMessage(error.message);
      }else if(!data.session){
        setMessage('Check your email to confirm your account. If you already registered, use “Forgot password?” instead.');
      }
    }else{
      const {error}=await supabase.auth.signInWithPassword({email:normalizedEmail,password});
      if(error){
        setIsError(true);
        setMessage(error.message);
      }
    }
    setBusy(false);
  }

  async function sendReset(){
    const normalizedEmail=email.trim().toLowerCase();
    if(!normalizedEmail){
      setIsError(true);
      setMessage('Enter your email address first.');
      return;
    }
    setBusy(true);
    setIsError(false);
    const {error}=await supabase.auth.resetPasswordForEmail(normalizedEmail,{
      redirectTo:`${window.location.origin}/`,
    });
    setBusy(false);
    if(error){
      setIsError(true);
      setMessage(error.message);
    }else{
      setMessage('If an account exists for that email, a password-reset link is on its way.');
    }
  }

  return <main className="auth-layout"><section className="auth-panel"><div className="auth-card"><Brand/><h1>{signup?'Create your account':'Welcome back'}</h1><p>{signup?'Join your church care team.':'Sign in to your role-based workspace.'}</p>{message&&<div className={`notice${isError?' error':''}`}>{message}</div>}<form onSubmit={submit}>{signup&&<label>Full name<input name="name" autoComplete="name" required/></label>}<label>Email<input name="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input name="password" type="password" minLength={signup?8:6} autoComplete={signup?'new-password':'current-password'} required/>{signup&&<small>8+ characters with uppercase, lowercase, number, and symbol.</small>}</label><button className="primary" disabled={busy}>{busy?'Please wait…':signup?'Create account':'Sign in'}</button></form>{!signup&&<button className="text-btn" disabled={busy} onClick={()=>void sendReset()}>Forgot password?</button>}<button className="text-btn" onClick={()=>{setSignup(!signup);setMessage('');setIsError(false)}}>{signup?'Already have an account? Sign in':'Need an account? Sign up'}</button></div></section><section className="auth-visual"><div><h2>Welcome every person.<br/>Track every follow-up.<br/>Support every need.</h2><p>Secure ministry care for ushers, pastors and administrators.</p></div></section></main>
}
