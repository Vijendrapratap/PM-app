import { useEffect, useState } from 'react';

interface DeadlineTimerProps {
  deadline?: string | null;
  completed?: boolean;
}

const formatRemaining = (deadline: string, now: number): { label: string; tone: 'danger' | 'warning' | 'neutral' } => {
  const diffMs = new Date(deadline).getTime() - now;
  if (diffMs <= 0) return { label: 'Expired', tone: 'danger' };

  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  const tone = diffMs <= 24 * 3600000 ? 'warning' : 'neutral';

  if (days >= 1) return { label: `${days} Day${days === 1 ? '' : 's'} ${hours} Hour${hours === 1 ? '' : 's'} Remaining`, tone };
  if (hours >= 1) return { label: `${hours} Hour${hours === 1 ? '' : 's'} Remaining`, tone };
  return { label: `${minutes} Minute${minutes === 1 ? '' : 's'} Remaining`, tone };
};

const TONE_COLOR: Record<string, string> = {
  danger: 'var(--danger)',
  warning: 'var(--accent-orange, #d97706)',
  neutral: 'var(--text-secondary)',
  success: 'var(--success)',
};

// Live countdown to a project/task deadline. Stops updating once `completed`
// is true (the timer has no more meaning after that) - see plan.
const DeadlineTimer = ({ deadline, completed }: DeadlineTimerProps) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (completed || !deadline) return;
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, [completed, deadline]);

  if (completed) {
    return <span className="badge badge-success">Completed</span>;
  }
  if (!deadline) {
    return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No deadline</span>;
  }

  const { label, tone } = formatRemaining(deadline, now);
  return (
    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: TONE_COLOR[tone] }}>
      {label}
    </span>
  );
};

export default DeadlineTimer;
