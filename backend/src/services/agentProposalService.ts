import { agentProposalRepository } from '../repositories/agentProposalRepository';
import { agentWorkflowRepository } from '../repositories/agentWorkflowRepository';
import { activityLogRepository } from '../repositories/activityLogRepository';
import { projectRepository } from '../repositories/projectRepository';
import { agentWorkflowService } from './agentWorkflowService';
import { badRequest, forbidden, notFound } from '../utils/httpError';
import { canApproveAgentWork, canViewAllProjects } from '../utils/roles';
import { validateAgentProposalActions } from '../utils/agentProposalValidation';
interface Actor { id: string; role: string }
const assertProposalAccess = async (proposal: any, actor: Actor, approve = false) => {
  if (approve && !canApproveAgentWork(actor.role)) throw forbidden('Only an authorized Manager or CEO can decide structural proposals');
  if (!proposal.project_id || canViewAllProjects(actor.role)) return;
  if (!(await projectRepository.isMemberAssigned(proposal.project_id, actor.id))) throw forbidden('Proposal is outside your project scope');
};
export const agentProposalService = {
  async getRun(id: string, actor: Actor) { const run = await agentWorkflowRepository.findRunById(id); if (!run) throw notFound('Agent run not found'); if (run.project_id) await assertProposalAccess({ project_id: run.project_id }, actor); return run; },
  async get(id: string, actor: Actor) { const proposal = await agentProposalRepository.findById(id); if (!proposal) throw notFound('Agent proposal not found'); await assertProposalAccess(proposal, actor); return proposal; },
  async apply(id: string, actor: Actor) {
    const proposal = await agentProposalRepository.findById(id); if (!proposal) throw notFound('Agent proposal not found'); await assertProposalAccess(proposal, actor, true);
    if (proposal.status === 'APPLIED') return proposal;
    const actions = Array.isArray(proposal.actions_json) ? proposal.actions_json : [];
    if (!validateAgentProposalActions(actions)) throw badRequest('Proposal contains an action outside the application-service allowlist');
    const publish = actions.find((action: any) => action.type === 'PUBLISH_PLAN');
    const approveDocument = actions.find((action: any) => action.type === 'APPROVE_DOCUMENT');
    if (!proposal.project_id) throw badRequest('Proposal is not linked to a project');
    if (publish?.planId) await agentWorkflowService.approvePlan(proposal.project_id, String(publish.planId), actor);
    else if (approveDocument?.versionId) await agentWorkflowService.approveDocumentVersion(proposal.project_id, String(approveDocument.versionId), actor);
    else throw badRequest('Proposal contains no supported structural actions');
    return agentProposalRepository.findById(id);
  },
  async reject(id: string, note: string | undefined, actor: Actor) {
    const proposal = await agentProposalRepository.findById(id); if (!proposal) throw notFound('Agent proposal not found'); await assertProposalAccess(proposal, actor, true);
    const rejected = await agentProposalRepository.reject(id, actor.id, note); if (!rejected) throw badRequest('Proposal has already been decided');
    if (proposal.agent_run_id) await agentWorkflowRepository.updateRun(proposal.agent_run_id, { status: 'Changes requested', reviewed_by: actor.id, reviewed_at: new Date().toISOString(), review_note: note || 'Proposal rejected.' });
    await activityLogRepository.create({ action: 'Agent Proposal Rejected', user_id: actor.id, project_id: proposal.project_id, details: note || 'Agent proposal rejected.', event: { eventType: 'AGENT_PROPOSAL_REJECTED', entityType: 'AGENT_PROPOSAL', entityId: id, payload: { note } } });
    return rejected;
  },
};
