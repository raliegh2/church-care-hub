/**
 * Original identity mark for Central Islip SDA Church Care.
 *
 * Deliberately NOT a reproduction of the Seventh-day Adventist denominational
 * logo, which is a registered trademark of the General Conference. The motif is
 * an arched sanctuary window enclosing two cupped hands that read as a heart —
 * shelter and care. Swap in the officially licensed mark here when it is
 * available; nothing else in the app needs to change.
 */
export function Emblem({
  size = 64,
  animated = false,
  title = 'Central Islip SDA Church Care',
}: {
  size?: number;
  animated?: boolean;
  title?: string;
}) {
  return (
    <svg
      className={`emblem${animated ? ' emblem-animated' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label={title}
    >
      <circle className="emblem-halo" cx="32" cy="32" r="30" />
      <path
        className="emblem-arch"
        d="M32 8c8.2 0 14 6.3 14 14.6V52a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2V22.6C18 14.3 23.8 8 32 8Z"
      />
      <path className="emblem-hand emblem-hand-left" d="M32 44c-6.4-4.1-9.6-7.7-9.6-11.6a5.2 5.2 0 0 1 9.6-2.8" />
      <path className="emblem-hand emblem-hand-right" d="M32 44c6.4-4.1 9.6-7.7 9.6-11.6a5.2 5.2 0 0 0-9.6-2.8" />
      <circle className="emblem-light" cx="32" cy="20" r="2.6" />
    </svg>
  );
}
