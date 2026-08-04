import { supabase } from '../config/supabase';

const SELECT_WITH_ACTOR = '*, actor:user_id(id, name, photo), project:project_id(id, name)';

interface StructuredEventInput {
  eventType: string;
  entityType: string;
  entityId?: string | null;
  departmentId?: string | null;
  payload?: Record<string, unknown>;
  actorType?: 'USER' | 'AGENT' | 'SYSTEM';
  correlationId?: string;
  agentRunId?: string | null;
}

interface ActivityInput {
  action: string;
  user_id: string;
  project_id?: string;
  details: string;
  event?: StructuredEventInput;
}

const eventTypeFor = (action: string) => action
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

export const activityLogRepository = {
  async create(input: ActivityInput): Promise<void> {
    const { event, ...legacy } = input;
    const { error } = await supabase.from('activity_logs').insert(legacy);
    if (error) throw error;

    const { data: actor, error: actorError } = await supabase
      .from('users')
      .select('organization_id, department_id')
      .eq('id', input.user_id)
      .single();
    if (actorError) throw actorError;

    const entityType = event?.entityType || (input.project_id ? 'PROJECT' : 'USER');
    const entityId = event?.entityId === undefined
      ? (input.project_id || input.user_id)
      : event.entityId;
    const { error: eventError } = await supabase.from('activity_events').insert({
      organization_id: actor.organization_id,
      actor_user_id: input.user_id,
      actor_type: event?.actorType || 'USER',
      event_type: event?.eventType || eventTypeFor(input.action),
      entity_type: entityType,
      entity_id: entityId || null,
      project_id: input.project_id || null,
      department_id: event?.departmentId === undefined ? actor.department_id : event.departmentId,
      payload_json: { details: input.details, ...(event?.payload || {}) },
      ...(event?.correlationId && { correlation_id: event.correlationId }),
      agent_run_id: event?.agentRunId || null,
    });
    if (eventError) throw eventError;
  },

  async findRecent(limit = 15): Promise<any[]> {
    const { data, error } = await supabase
      .from('activity_logs')
      .select(SELECT_WITH_ACTOR)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async findProjectEvents(projectId: string, limit = 100): Promise<any[]> {
    const { data, error } = await supabase
      .from('activity_events')
      .select('*, actor:actor_user_id(id, name, photo)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },
};
