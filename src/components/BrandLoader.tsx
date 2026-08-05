import { Emblem } from './Emblem';

/**
 * Full-screen loading state. Purely presentational — it renders while the
 * session and profile requests in App.tsx are in flight and never changes
 * what those requests do.
 */
export function BrandLoader({
  message = 'Preparing your ministry workspace',
  hint = 'Checking your access and loading your records',
}: {
  message?: string;
  hint?: string;
}) {
  return (
    <main className="brand-loader" role="status" aria-live="polite">
      <div className="brand-loader-card">
        <Emblem size={76} animated />
        <div className="brand-loader-copy">
          <strong>Central Islip SDA</strong>
          <span>{message}</span>
          <small>{hint}</small>
        </div>
        <div className="brand-loader-track" aria-hidden="true"><span /></div>
      </div>
    </main>
  );
}
