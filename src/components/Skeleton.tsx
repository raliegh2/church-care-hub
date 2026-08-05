import type { CSSProperties } from 'react';

/**
 * Skeleton placeholders. These render in place of content while a fetch is in
 * flight. They are presentation only — no skeleton component reads or writes
 * application state, and none of them gate a permission check.
 */

export function Skeleton({
  width = '100%',
  height = 14,
  radius = 6,
  className = '',
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  className?: string;
}) {
  const style: CSSProperties = { width, height, borderRadius: radius };
  return <span className={`skeleton ${className}`.trim()} style={style} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, lastWidth = '62%' }: { lines?: number; lastWidth?: string }) {
  return (
    <span className="skeleton-text" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} height={11} width={index === lines - 1 ? lastWidth : '100%'} />
      ))}
    </span>
  );
}

function SkeletonShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="skeleton-shell" role="status" aria-busy="true" aria-label={label}>
      {children}
    </div>
  );
}

function MetricSkeleton({ count }: { count: number }) {
  return (
    <div className="dashboard-metric-grid three-up">
      {Array.from({ length: count }, (_, index) => (
        <article key={index} className="panel skeleton-metric">
          <Skeleton width="52%" height={10} />
          <Skeleton width="38%" height={28} radius={8} />
          <Skeleton width="72%" height={10} />
        </article>
      ))}
    </div>
  );
}

export function DashboardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <SkeletonShell label="Loading your care overview">
      <MetricSkeleton count={compact ? 3 : 4} />
      <div className="dashboard-content-grid">
        <article className="panel skeleton-panel">
          <Skeleton width="34%" height={13} />
          <div className="skeleton-bars">
            {[38, 64, 46, 82, 55, 71, 43, 60].map((value, index) => (
              <Skeleton key={index} width="100%" height={`${value}%`} radius={4} className="skeleton-bar" />
            ))}
          </div>
        </article>
        <article className="panel skeleton-panel">
          <Skeleton width="42%" height={13} />
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="skeleton-row">
              <Skeleton width={34} height={34} radius={17} />
              <span className="skeleton-row-copy">
                <Skeleton width="58%" height={11} />
                <Skeleton width="34%" height={9} />
              </span>
              <Skeleton width={56} height={20} radius={10} />
            </div>
          ))}
        </article>
      </div>
    </SkeletonShell>
  );
}

export function PeopleListSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="rows person-rows" role="status" aria-busy="true" aria-label="Loading records">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton-person-row">
          <Skeleton width={32} height={32} radius={16} />
          <span className="skeleton-row-copy">
            <Skeleton width={`${72 - index * 6}%`} height={11} />
            <Skeleton width={`${48 - index * 4}%`} height={9} />
          </span>
        </div>
      ))}
    </div>
  );
}

export function PersonDetailSkeleton() {
  return (
    <SkeletonShell label="Loading care record">
      <div className="skeleton-detail-head">
        <Skeleton width={46} height={46} radius={23} />
        <span className="skeleton-row-copy">
          <Skeleton width="46%" height={15} />
          <Skeleton width="30%" height={10} />
        </span>
      </div>
      <div className="care-status-grid">
        {Array.from({ length: 2 }, (_, index) => (
          <article key={index} className="status-card skeleton-panel">
            <Skeleton width="54%" height={10} />
            <Skeleton width="34%" height={20} radius={7} />
          </article>
        ))}
      </div>
      <article className="panel skeleton-panel">
        <Skeleton width="30%" height={12} />
        <SkeletonText lines={3} />
      </article>
    </SkeletonShell>
  );
}

export function AdminSkeleton() {
  return (
    <SkeletonShell label="Loading the administrator centre">
      <MetricSkeleton count={4} />
      <article className="panel skeleton-panel">
        <Skeleton width="38%" height={13} />
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="skeleton-row">
            <span className="skeleton-row-copy">
              <Skeleton width={`${64 - index * 5}%`} height={11} />
              <Skeleton width="26%" height={9} />
            </span>
            <Skeleton width={72} height={26} radius={7} />
          </div>
        ))}
      </article>
    </SkeletonShell>
  );
}
