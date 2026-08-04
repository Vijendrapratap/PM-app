import { supabase } from '../config/supabase';
import { User } from '../types/models';

const TABLE = 'users';
// Assigned-projects lookup for the Team Members page (Super Admin view).
const WITH_PROJECTS_SELECT = '*, project_members(project:project_id(id, name, status))';

// Escapes ILIKE wildcard/escape characters so findByEmail only ever matches
// the literal address, not a pattern.
const escapeForIlike = (value: string) => value.replace(/[%_\\]/g, (char) => `\\${char}`);

export const userRepository = {
  async findByEmail(email: string): Promise<User | null> {
    // Case-insensitive match: emails are normalized to lowercase going
    // forward (see emailSchema), but accounts created before that existed
    // may still have mixed-case values stored, which would otherwise cause
    // a correct login to fail with a false "invalid credentials".
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .ilike('email', escapeForIlike(email))
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async findById(id: string): Promise<User | null> {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async findByIdWithProjects(id: string): Promise<any | null> {
    const { data, error } = await supabase.from(TABLE).select(WITH_PROJECTS_SELECT).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(input: {
    name: string;
    email: string;
    password_hash: string;
    role: string;
    department?: string;
    phone?: string;
    skills?: string[];
    organization_id?: string;
    platform_role?: 'CEO' | 'MANAGER' | 'TEAM_MEMBER';
    designation?: string;
    department_id?: string;
    manager_user_id?: string;
    timezone?: string;
    daily_capacity_minutes?: number;
    account_status?: 'INVITED' | 'ACTIVE';
    invited_at?: string;
  }): Promise<User> {
    let organizationId = input.organization_id;
    if (!organizationId) {
      const { data: organization, error: organizationError } = await supabase
        .from('organizations')
        .select('id')
        .order('created_at')
        .limit(1)
        .single();
      if (organizationError) throw organizationError;
      organizationId = organization.id;
    }
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        ...input,
        organization_id: organizationId,
        platform_role: input.platform_role || 'TEAM_MEMBER',
        designation: input.designation || input.role,
        department: input.department || 'General',
        account_status: input.account_status || 'ACTIVE',
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async list(organizationId?: string): Promise<any[]> {
    let query = supabase
      .from(TABLE)
      .select(WITH_PROJECTS_SELECT)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (organizationId) query = query.eq('organization_id', organizationId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async findManyActiveByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .in('id', ids)
      .eq('status', 'Active')
      .is('deleted_at', null);
    if (error) throw error;
    return data;
  },

  async findActiveByRoles(roles: string[], organizationId?: string): Promise<User[]> {
    if (!roles.length) return [];
    let query = supabase
      .from(TABLE)
      .select('*')
      .in('role', roles)
      .eq('status', 'Active')
      .is('deleted_at', null);
    if (organizationId) query = query.eq('organization_id', organizationId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async findActiveByPlatformRoles(roles: Array<'CEO' | 'MANAGER' | 'TEAM_MEMBER'>, organizationId?: string): Promise<User[]> {
    if (!roles.length) return [];
    let query = supabase
      .from(TABLE)
      .select('*')
      .in('platform_role', roles)
      .eq('status', 'Active')
      .is('deleted_at', null);
    if (organizationId) query = query.eq('organization_id', organizationId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: Partial<User>): Promise<User | null> {
    const { data, error } = await supabase.from(TABLE).update(patch).eq('id', id).select('*').maybeSingle();
    if (error) throw error;
    return data;
  },

  async countOtherActiveSuperAdmins(excludeId: string): Promise<number> {
    const { count, error } = await supabase
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('platform_role', 'CEO')
      .eq('status', 'Active')
      .is('deleted_at', null)
      .neq('id', excludeId);
    if (error) throw error;
    return count ?? 0;
  },

  async softDelete(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString(), status: 'Inactive' })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};
