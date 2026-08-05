import { ArrowLeft, SearchX } from 'lucide-react';
import { Brand } from '../components/Brand';

export function NotFoundPage({ onHome }: { onHome: () => void }) {
  return (
    <main className="center-screen">
      <section className="onboarding-card" aria-labelledby="not-found-title">
        <Brand />
        <div className="eyebrow">Error 404</div>
        <SearchX size={42} aria-hidden="true" />
        <h1 id="not-found-title">Page not found</h1>
        <p>The page you requested does not exist or is no longer available.</p>
        <button className="primary" type="button" onClick={onHome}>
          <ArrowLeft size={17} aria-hidden="true" /> Return to sign in
        </button>
      </section>
    </main>
  );
}
