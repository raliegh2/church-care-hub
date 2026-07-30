import { useState, type FormEvent } from 'react';
import { Brand } from '../components/Brand';
import { supabase } from '../lib/supabase';

export function ResetPasswordPage({onDone}:{onDone:()=>void}){
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    setMessage('');
    const f=new FormData(e.currentTarget);
    const password=String(f.get('password'));
    const confirmation=String(f.get('confirmation'));

    if(password!==confirmation){
      setMessage('The passwords do not match.');
      return;
    }
    if(!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)){
      setMessage('Use at least 8 characters with an uppercase letter, lowercase letter, number, and symbol.');
      return;
    }

    setBusy(true);
    const {error}=await supabase.auth.updateUser({password});
    setBusy(false);
    if(error)setMessage(error.message);
    else onDone();
  }

  return <main className="center-screen"><section className="onboarding-card"><Brand/><h1>Choose a new password</h1><p>Enter a new password for your Church Care Hub account.</p>{message&&<div className="notice error">{message}</div>}<form onSubmit={submit}><label>New password<input name="password" type="password" minLength={8} autoComplete="new-password" required/><small>8+ characters with uppercase, lowercase, number, and symbol.</small></label><label>Confirm new password<input name="confirmation" type="password" minLength={8} autoComplete="new-password" required/></label><button className="primary" disabled={busy}>{busy?'Saving…':'Update password'}</button></form></section></main>
}
