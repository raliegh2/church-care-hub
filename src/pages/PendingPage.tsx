import { Brand } from '../components/Brand';
import { supabase } from '../lib/supabase';

export function PendingPage(){return <main className="center-screen"><section className="onboarding-card"><Brand/><h1>Pastor access pending</h1><p>Your request is waiting for the administrator to approve it.</p><button className="secondary" onClick={()=>supabase.auth.signOut()}>Sign out</button></section></main>}
