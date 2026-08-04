import { supabase } from '../config/supabase';
const SELECT = '*, run:agent_run_id(*), approver:approved_by(id, name)';
export const agentProposalRepository = {
  async create(input: Record<string, unknown>) { const { data, error } = await supabase.from('agent_proposals').insert(input).select(SELECT).single(); if (error) throw error; return data; },
  async findById(id: string) { const { data, error } = await supabase.from('agent_proposals').select(SELECT).eq('id', id).maybeSingle(); if (error) throw error; return data; },
  async findForRun(runId: string) { const { data, error } = await supabase.from('agent_proposals').select(SELECT).eq('agent_run_id', runId).order('created_at', { ascending: false }).limit(1).maybeSingle(); if (error) throw error; return data; },
  async claim(id: string, approverId: string) { const { data, error } = await supabase.from('agent_proposals').update({ status: 'APPLYING', approved_by: approverId, updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'PENDING').select(SELECT).maybeSingle(); if (error) throw error; return data; },
  async applied(id: string, actions: unknown) { const now = new Date().toISOString(); const { data, error } = await supabase.from('agent_proposals').update({ status: 'APPLIED', applied_actions_json: actions, applied_at: now, error: null, updated_at: now }).eq('id', id).eq('status', 'APPLYING').select(SELECT).single(); if (error) throw error; return data; },
  async failed(id: string, message: string) { const { error } = await supabase.from('agent_proposals').update({ status: 'PENDING', error: message, updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'APPLYING'); if (error) throw error; },
  async reject(id: string, actorId: string, note?: string) { const now = new Date().toISOString(); const { data, error } = await supabase.from('agent_proposals').update({ status: 'REJECTED', approved_by: actorId, decision_note: note || null, rejected_at: now, updated_at: now }).eq('id', id).eq('status', 'PENDING').select(SELECT).maybeSingle(); if (error) throw error; return data; },
};
