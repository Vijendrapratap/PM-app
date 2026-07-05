import { supabase } from '../config/supabase';
import { User } from '../types/models';

const TABLE = 'users';

export const userRepository = {
  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase.from(TABLE).select('*').eq('email', email).maybeSingle();
    if (error) throw error;
    return data;
  },

  async findById(id: string): Promise<User | null> {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
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
  }): Promise<User> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ ...input, department: input.department || 'General' })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async list(): Promise<User[]> {
    const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async findManyActiveByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    const { data, error } = await supabase.from(TABLE).select('*').in('id', ids).eq('status', 'Active');
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: Partial<User>): Promise<User | null> {
    const { data, error } = await supabase.from(TABLE).update(patch).eq('id', id).select('*').maybeSingle();
    if (error) throw error;
    return data;
  },
};
