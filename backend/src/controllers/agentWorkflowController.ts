import { Request, Response } from 'express';
import { agentWorkflowService } from '../services/agentWorkflowService';
import { asyncHandler } from '../utils/asyncHandler';
import { unauthorized } from '../utils/httpError';
import { param } from '../utils/params';

const actorOf = (req: Request) => {
  if (!req.user) throw unauthorized('Not authorized');
  return req.user;
};

export const getAgentReviewQueue = asyncHandler(async (req: Request, res: Response) => {
  res.json(await agentWorkflowService.getReviewQueue(actorOf(req)));
});

export const getAgentStatus = asyncHandler(async (req: Request, res: Response) => {
  res.json(await agentWorkflowService.getStatus(actorOf(req)));
});

export const getAgentDefinitions = asyncHandler(async (req: Request, res: Response) => {
  res.json(await agentWorkflowService.getDefinitions(actorOf(req)));
});

export const updateAgentDefinition = asyncHandler(async (req: Request, res: Response) => {
  res.json(await agentWorkflowService.updateDefinition(param(req, 'definitionId'), req.body.systemPrompt, req.body.changeNote, actorOf(req)));
});

export const getAgentWorkspace = asyncHandler(async (req: Request, res: Response) => {
  res.json(await agentWorkflowService.getWorkspace(param(req, 'id'), actorOf(req)));
});

export const runProjectManagerAgent = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await agentWorkflowService.runProjectManagerAgent(param(req, 'id'), actorOf(req), req.body.force === true));
});

export const updatePlanDraft = asyncHandler(async (req: Request, res: Response) => {
  res.json(await agentWorkflowService.updatePlan(param(req, 'id'), param(req, 'planId'), req.body.content, actorOf(req)));
});

export const approvePlanDraft = asyncHandler(async (req: Request, res: Response) => {
  res.json(await agentWorkflowService.approvePlan(param(req, 'id'), param(req, 'planId'), actorOf(req)));
});

export const runBusinessAnalystAgent = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await agentWorkflowService.runBusinessAnalystAgent(
    param(req, 'id'), param(req, 'planId'), actorOf(req), req.body.force === true
  ));
});

export const updateKnowledgeDocumentVersion = asyncHandler(async (req: Request, res: Response) => {
  res.json(await agentWorkflowService.updateDocumentVersion(
    param(req, 'id'), param(req, 'versionId'), req.body.content, actorOf(req)
  ));
});

export const approveKnowledgeDocumentVersion = asyncHandler(async (req: Request, res: Response) => {
  res.json(await agentWorkflowService.approveDocumentVersion(param(req, 'id'), param(req, 'versionId'), actorOf(req)));
});
