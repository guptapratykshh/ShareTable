import { useEffect, useState } from "react";
import { remainingMs } from "../utils/format";

export function useCountdown(expiresAt?: string) {
  const [ms, setMs] = useState(() => (expiresAt ? remainingMs(expiresAt) : 0));

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setMs(remainingMs(expiresAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  return ms;
}
