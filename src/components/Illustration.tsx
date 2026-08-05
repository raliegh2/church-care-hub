import type { ReactNode } from 'react';

/**
 * Original vector artwork. Replaces stock photography so there is no third
 * party licence to track, nothing to hotlink and no extra network request.
 * Every shape inherits its colour from the Sanctuary palette via the
 * .il-* classes in sanctuary.css.
 */

export type IllustrationName = 'welcome' | 'visitors' | 'members' | 'notes' | 'select' | 'import';

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg className="illustration" viewBox="0 0 160 120" fill="none" role="img" aria-label={label}>
      {children}
    </svg>
  );
}

export function Illustration({ name }: { name: IllustrationName }) {
  if (name === 'welcome') {
    return (
      <Frame label="An arched sanctuary window over a gathered congregation">
        <path className="il-tint" d="M44 96V44c0-19.9 16.1-36 36-36s36 16.1 36 36v52Z" />
        <path className="il-line" d="M80 8v88M44 60h72" />
        <path className="il-accent" d="M80 26c7 6.2 11 14 11 22.4S87 65.6 80 71c-7-5.4-11-14.2-11-22.6S73 32.2 80 26Z" />
        <circle className="il-solid" cx="38" cy="88" r="9" />
        <circle className="il-solid" cx="80" cy="84" r="11" />
        <circle className="il-solid" cx="122" cy="88" r="9" />
        <path className="il-solid" d="M20 112c0-9.9 8.1-16 18-16s18 6.1 18 16Zm42 0c0-11.6 8.1-19 18-19s18 7.4 18 19Zm42 0c0-9.9 8.1-16 18-16s18 6.1 18 16Z" />
      </Frame>
    );
  }

  if (name === 'visitors') {
    return (
      <Frame label="An open door with a welcome path leading in">
        <path className="il-tint" d="M58 100V38c0-5.5 4.5-10 10-10h34v72Z" />
        <path className="il-line" d="M58 100h60M102 28v72M46 100h68" />
        <circle className="il-accent" cx="94" cy="66" r="3.5" />
        <path className="il-line" d="M22 100c14-4 22-11 26-22" />
        <circle className="il-solid" cx="30" cy="62" r="8" />
        <path className="il-solid" d="M16 92c0-8.8 6.3-15 14-15s14 6.2 14 15Z" />
      </Frame>
    );
  }

  if (name === 'members') {
    return (
      <Frame label="Three people standing together">
        <circle className="il-solid" cx="46" cy="48" r="12" />
        <circle className="il-solid" cx="114" cy="48" r="12" />
        <circle className="il-accent" cx="80" cy="40" r="15" />
        <path className="il-solid" d="M24 104c0-12.7 9.9-22 22-22s22 9.3 22 22Zm68 0c0-12.7 9.9-22 22-22s22 9.3 22 22Z" />
        <path className="il-accent" d="M53 106c0-15.5 12.1-27 27-27s27 11.5 27 27Z" />
      </Frame>
    );
  }

  if (name === 'notes') {
    return (
      <Frame label="A card with a heart, representing a care note">
        <path className="il-tint" d="M34 26h74a8 8 0 0 1 8 8v68a8 8 0 0 1-8 8H34a8 8 0 0 1-8-8V34a8 8 0 0 1 8-8Z" />
        <path className="il-line" d="M44 46h54M44 60h54M44 74h30" />
        <path className="il-accent" d="M120 62c5.4-5.2 14-3.6 17 3 2.4 5.4-.4 11.2-5.6 15.4L120 90l-11.4-9.6c-5.2-4.2-8-10-5.6-15.4 3-6.6 11.6-8.2 17-3Z" />
      </Frame>
    );
  }

  if (name === 'import') {
    return (
      <Frame label="A spreadsheet with rows flowing upward into the app">
        <path className="il-tint" d="M32 46h60a6 6 0 0 1 6 6v54a6 6 0 0 1-6 6H32a6 6 0 0 1-6-6V52a6 6 0 0 1 6-6Z" />
        <path className="il-line" d="M26 66h72M26 86h72M62 46v66" />
        <path className="il-accent" d="M124 76V30m0 0-13 13m13-13 13 13" />
        <path className="il-line" d="M106 96h36" />
      </Frame>
    );
  }

  return (
    <Frame label="A list with one entry highlighted for selection">
      <path className="il-tint" d="M28 30h50a6 6 0 0 1 6 6v72a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6V36a6 6 0 0 1 6-6Z" />
      <path className="il-line" d="M36 48h34M36 66h34M36 84h22" />
      <path className="il-accent" d="M100 44h32a8 8 0 0 1 8 8v40a8 8 0 0 1-8 8h-32a8 8 0 0 1-8-8V52a8 8 0 0 1 8-8Z" />
      <path className="il-line" d="M104 62h24M104 76h16" />
    </Frame>
  );
}

export function EmptyState({
  name,
  title,
  detail,
  action,
}: {
  name: IllustrationName;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Illustration name={name} />
      <strong>{title}</strong>
      {detail && <p>{detail}</p>}
      {action}
    </div>
  );
}
