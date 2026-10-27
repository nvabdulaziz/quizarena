export default function TimerBar({ remainingMs, totalMs }) {
  const pct = totalMs ? Math.max(0, Math.min(100, (remainingMs / totalMs) * 100)) : 0;
  const low = pct < 25;
  return (
    <div className="h-4 w-full overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-[width] duration-100 ease-linear ${low ? 'bg-coral' : 'bg-sun'}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
