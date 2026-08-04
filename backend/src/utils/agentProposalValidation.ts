const SUPPORTED_ACTIONS = new Set(['PUBLISH_PLAN', 'APPROVE_DOCUMENT']);
export const validateAgentProposalActions = (actions: unknown): actions is Array<Record<string, unknown> & { type: string }> => Array.isArray(actions) && actions.length > 0 && actions.every((action) => Boolean(action) && typeof action === 'object' && SUPPORTED_ACTIONS.has(String((action as any).type)));
