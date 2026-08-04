const IMMEDIATE = new Set(['new_assignment', 'critical_blocker', 'review_request', 'review_rejected', 'milestone_risk', 'scope_change', 'decision_required', 'mention', 'project_owner_changed']);
export const notificationDelivery = (type: string, priority?: string) => priority === 'CRITICAL' || IMMEDIATE.has(type) ? 'IMMEDIATE' : 'DIGEST';
