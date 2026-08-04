export function Brand({
  compact = false,
  subtitle = 'Church Care System',
}: {
  compact?: boolean;
  subtitle?: string;
}) {
  return (
    <div className={`brand${compact ? ' brand-compact' : ''}`}>
      <span className="brand-mark" aria-hidden="true" />
      <span className="brand-copy">
        <strong>Central Islip SDA</strong>
        {!compact && <small>{subtitle}</small>}
      </span>
    </div>
  );
}
