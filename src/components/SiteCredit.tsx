import './SiteCredit.css';

export function SiteCredit() {
  return (
    <footer className="site-credit" aria-label="Website creator credit">
      <span>Website designed and developed by</span>
      <img
        src="/cyventura-logo.svg"
        alt="Cyventura"
        width="581"
        height="338"
        loading="lazy"
        decoding="async"
      />
    </footer>
  );
}
