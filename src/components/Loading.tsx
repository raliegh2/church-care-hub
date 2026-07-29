import { Brand } from './Brand';

export function Loading() {
  return <main className="center-screen"><div className="loading-card"><Brand /><div className="spinner"/><p>Preparing your ministry workspace…</p></div></main>;
}
