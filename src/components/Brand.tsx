import { Church } from 'lucide-react';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark"><Church size={compact ? 20 : 26} /></span>
      <span>
        <strong>Church Care Hub</strong>
        {!compact && <small>Visitor, member and care management</small>}
      </span>
    </div>
  );
}
