import { Crown, UserRound, Workflow } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { DemoPersona } from '../context/demoPersonas';

const personas: Array<{ id: DemoPersona; label: string; detail: string; icon: typeof Crown }> = [
  { id: 'ceo', label: 'CEO', detail: 'Pratap', icon: Crown },
  { id: 'delivery', label: 'PM / Tech Lead', detail: 'Govind & Anush', icon: Workflow },
  { id: 'team', label: 'Team member', detail: 'Alex', icon: UserRound },
];

const DemoPersonaBar = () => {
  const { demoPersona, startDemo } = useAuth();

  return (
    <section className="demo-persona-bar" aria-label="Demo role switcher">
      <div>
        <span>Interactive preview</span>
        <small>Switch roles to compare what each person sees</small>
      </div>
      <div className="demo-persona-switch">
        {personas.map(({ id, label, detail, icon: Icon }) => (
          <button
            type="button"
            className={demoPersona === id ? 'active' : ''}
            aria-pressed={demoPersona === id}
            onClick={() => startDemo(id)}
            key={id}
          >
            <Icon size={14}/>
            <span><strong>{label}</strong><small>{detail}</small></span>
          </button>
        ))}
      </div>
    </section>
  );
};

export default DemoPersonaBar;
