export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  platformRole?: 'CEO' | 'MANAGER' | 'TEAM_MEMBER';
  designation?: string | null;
  department?: string | null;
  photo?: string | null;
  onboardingRequired?: boolean;
}

export type DemoPersona = 'ceo' | 'delivery' | 'team';

export const DEMO_PERSONAS: Record<DemoPersona, AuthUser> = {
  ceo: { _id: 'demo-ceo', name: 'Vijendra Pratap Singh', email: 'vijendra@pratap.local', role: 'Super Admin', platformRole: 'CEO', designation: 'CEO', department: 'Leadership' },
  delivery: { _id: 'demo-delivery', name: 'Govind & Anush', email: 'delivery.demo@pratap.ai', role: 'Project Manager', platformRole: 'MANAGER', designation: 'Project Manager / Tech Lead', department: 'Delivery' },
  team: { _id: 'demo-team', name: 'Devesh', email: 'devesh@pratap.local', role: 'Team Member', platformRole: 'TEAM_MEMBER', designation: 'Developer', department: 'Development' },
};
