import { supabase } from '../config/supabase';
import { AppNotification } from '../types/models';

const TABLE = 'notifications';

export const notificationRepository = {
  async create(input: {
    user_id: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    related_type?: string;
    related_id?: string;
  }): Promise<void> {
    // The unique index on (user_id, type, related_type, related_id) in the
    // migration makes this idempotent for the lazy due-soon/overdue
    // generators - a repeat call for the same item/user/type is a no-op.
    const { error } = await supabase.from(TABLE).insert(input).select('id').maybeSingle();
    if (error && error.code !== '23505') throw error;
  },

  async findForUser(userId: string, limit = 30): Promise<AppNotification[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async countUnread(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) throw error;
    return count ?? 0;
  },

  async markRead(id: string, userId: string): Promise<void> {
    const { error } = await supabase.from(TABLE).update({ read: true }).eq('id', id).eq('user_id', userId);
    if (error) throw error;
  },

  async markAllRead(userId: string): Promise<void> {
    const { error } = await supabase.from(TABLE).update({ read: true }).eq('user_id', userId).eq('read', false);
    if (error) throw error;
  },
};
