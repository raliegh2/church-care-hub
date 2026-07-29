import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AppShell } from './components/AppShell';
import { Loading } from './components/Loading';
import { supabase } from './lib/supabase';
import { AdminPage } from './pages/AdminPage';
import { AttendancePage } from './pages/AttendancePage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { ImportPage } from './pages/ImportPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { PendingPage } from './pages/PendingPage';
import { PeoplePage } from './pages/PeoplePage';
import type { UserProfile } from './types';

type Page='dashboard'|'attendance'|'visitors'|'members'|'import'|'admin';
export default function App(){const[session,setSession]=useState<Session|null>(null);const[profile,setProfile]=useState<UserProfile|null>(null);const[loading,setLoading]=useState(true);const[page,setPage]=useState<Page>('dashboard');const loadProfile=useCallback(async(current:Session|null)=>{if(!current){setProfile(null);setLoading(false);return}setLoading(true);const{data,error}=await supabase.from('user_profiles').select('*').eq('id',current.user.id).maybeSingle();if(error)console.error(error);setProfile((data||null) as UserProfile|null);setLoading(false)},[]);useEffect(()=>{void supabase.auth.getSession().then(({data})=>{setSession(data.session);return loadProfile(data.session)});const{data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);void loadProfile(next)});return()=>subscription.unsubscribe()},[loadProfile]);if(loading)return <Loading/>;if(!session)return <AuthPage/>;if(!profile)return <OnboardingPage defaultName={String(session.user.user_metadata.display_name||'')} onDone={()=>loadProfile(session)}/>;if(profile.role_status==='pending')return <PendingPage/>;return <AppShell profile={profile} page={page} setPage={setPage} signOut={()=>void supabase.auth.signOut()}>{page==='dashboard'&&<DashboardPage/>}{page==='attendance'&&<AttendancePage userId={session.user.id}/>} {page==='visitors'&&<PeoplePage type="visitor" userId={session.user.id}/>} {page==='members'&&<PeoplePage type="member" userId={session.user.id}/>} {page==='import'&&<ImportPage userId={session.user.id}/>} {page==='admin'&&<AdminPage/>}</AppShell>}
