import { HandHeart } from 'lucide-react';

export function Brand({
  compact = false,
  subtitle = 'Church Care System',
}: {
  compact?: boolean;
  subtitle?: string;
}) {
  return (
    <div className={`brand${compact ? ' brand-compact' : ''}`}>
      <span className="brand-mark" aria-hidden="true"><HandHeart size={20} strokeWidth={2.25} /></span>
      <span className="brand-copy">
        <strong>Central Islip SDA</strong>
        {!compact && <small>{subtitle}</small>}
      </span>
    </div>
  );
}
