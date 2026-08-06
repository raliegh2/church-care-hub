import { useEffect, useRef, useState } from 'react';

export function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(0);
  const previous = useRef(0);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    const start = previous.current;
    const delta = target - start;
    if (delta === 0) {
      setValue(target);
      return;
    }
    const startTime = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(start + delta * eased));
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        previous.current = target;
      }
    }

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
  }, [target, durationMs]);

  return value;
}
