import express from 'express';
import { applyAgentProposal, getAgentProposal, getAgentRun, rejectAgentProposal, runBaAgent, runPmAgent } from '../controllers/agentProposalController';
import { protect } from '../middleware/auth';
import { runCaseStudyAgent } from '../controllers/caseStudyController';
export const agentsRouter = express.Router(); agentsRouter.use(protect); agentsRouter.post('/pm/run', runPmAgent); agentsRouter.post('/ba/run', runBaAgent); agentsRouter.post('/case-study/run', runCaseStudyAgent);
export const agentRunsRouter = express.Router(); agentRunsRouter.use(protect); agentRunsRouter.get('/:runId', getAgentRun);
export const agentProposalsRouter = express.Router(); agentProposalsRouter.use(protect); agentProposalsRouter.get('/:proposalId', getAgentProposal); agentProposalsRouter.post('/:proposalId/apply', applyAgentProposal); agentProposalsRouter.post('/:proposalId/reject', rejectAgentProposal);
