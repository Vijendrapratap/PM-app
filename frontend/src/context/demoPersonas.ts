export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  department?: string | null;
  photo?: string | null;
}

export type DemoPersona = 'ceo' | 'delivery' | 'team';

export const DEMO_PERSONAS: Record<DemoPersona, AuthUser> = {
  ceo: { _id: 'demo-ceo', name: 'Pratap', email: 'pratap.demo@pratap.ai', role: 'Super Admin', department: 'Leadership' },
  delivery: { _id: 'demo-delivery', name: 'Govind & Anush', email: 'delivery.demo@pratap.ai', role: 'Project Manager', department: 'Delivery' },
  team: { _id: 'demo-team', name: 'Alex Rivera', email: 'team.demo@pratap.ai', role: 'Team Member', department: 'Engineering' },
};
