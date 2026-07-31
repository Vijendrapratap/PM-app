import OpenAI from 'openai';
import { env } from '../config/env';
import { ProjectPlanContent } from '../types/models';
import { projectPlanContentSchema } from '../utils/validators';
import { localAgentDraftProvider, ProjectContext } from './agentDraftProvider';

const priority = { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] };
const acceptanceCriteria = { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 20 };

// Kept alongside the provider so changes to the model contract are explicit
// and reviewable. The result is validated again with Zod before persistence.
const projectPlanSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'assumptions', 'risks', 'questions', 'features'],
  properties: {
    summary: { type: 'string' },
    assumptions: { type: 'array', items: { type: 'string' }, maxItems: 50 },
    risks: { type: 'array', items: { type: 'string' }, maxItems: 50 },
    questions: { type: 'array', items: { type: 'string' }, maxItems: 50 },
    features: {
      type: 'array', minItems: 1, maxItems: 30,
      items: {
        type: 'object', additionalProperties: false,
        required: ['key', 'title', 'outcome', 'description', 'acceptanceCriteria', 'priority', 'estimateDays', 'confidence', 'tasks'],
        properties: {
          key: { type: 'string' }, title: { type: 'string' }, outcome: { type: 'string' }, description: { type: 'string' },
          acceptanceCriteria, priority, estimateDays: { type: 'number', minimum: 0.25, maximum: 1000 },
          confidence: { type: 'string', enum: ['Low', 'Medium', 'High'] },
          tasks: {
            type: 'array', minItems: 1, maxItems: 50,
            items: {
              type: 'object', additionalProperties: false,
              required: ['key', 'title', 'description', 'estimateDays', 'priority', 'acceptanceCriteria'],
              properties: {
                key: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' },
                estimateDays: { type: 'number', minimum: 0.25, maximum: 365 }, priority, acceptanceCriteria,
              },
            },
          },
        },
      },
    },
  },
} as const;

const hostedProvider = env.openRouterApiKey
  ? {
      name: `OpenRouter · ${env.openRouterAgentModel}`,
      model: env.openRouterAgentModel,
      client: new OpenAI({
        apiKey: env.openRouterApiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: { 'HTTP-Referer': env.frontendUrl, 'X-Title': 'Pratap AI Operations Studio' },
      }),
    }
  : env.openAIApiKey
    ? { name: `OpenAI Responses API · ${env.openAIAgentModel}`, model: env.openAIAgentModel, client: new OpenAI({ apiKey: env.openAIApiKey }) }
    : null;

const requireHostedProvider = () => {
  if (!hostedProvider) throw new Error('No hosted agent provider is configured');
  return hostedProvider;
};

export const hostedAgentDraftProvider = {
  get name() { return requireHostedProvider().name; },

  async createProjectPlan(project: ProjectContext): Promise<ProjectPlanContent> {
    const provider = requireHostedProvider();
    const response = await provider.client.responses.create({
      model: provider.model,
      store: false,
      instructions: [
        'You are a senior startup project manager. Convert a project brief into a practical delivery plan for human review.',
        'Create outcome-based features and small executable tasks. Estimates are working-day estimates, never commitments.',
        'Do not invent customer facts, integrations, deadlines, or compliance requirements. Put uncertainty into assumptions, risks, or questions.',
        'Use stable kebab-case keys unique within this plan. Every acceptance criterion must be observable and testable.',
      ].join(' '),
      input: JSON.stringify(project),
      text: {
        format: {
          type: 'json_schema', name: 'project_delivery_plan', strict: true, schema: projectPlanSchema,
        },
      },
    });
    if (!response.output_text) throw new Error('The model returned an empty project plan');
    return projectPlanContentSchema.parse(JSON.parse(response.output_text));
  },

  async createBusinessRequirementsDocument(project: ProjectContext, plan: ProjectPlanContent) {
    const provider = requireHostedProvider();
    const response = await provider.client.responses.create({
      model: provider.model,
      store: false,
      instructions: [
        'You are a senior business analyst. Produce a concise, complete Business Requirements Document in Markdown.',
        'Base every requirement on the supplied project and approved plan. Do not invent facts; label uncertainty as an assumption or open question.',
        'Include: document status, project overview, goals, users/stakeholders where known, scope and exclusions, functional requirements by feature,',
        'non-functional requirements, acceptance criteria, dependencies, risks, open questions, and an approval section.',
        'The first lines must clearly say Agent draft and that Govind / Project Manager approval is required.',
      ].join(' '),
      input: JSON.stringify({ project, approvedPlan: plan }),
    });
    if (!response.output_text) throw new Error('The model returned an empty business requirements document');
    return {
      content: response.output_text,
      structuredContent: { summary: plan.summary, featureCount: plan.features.length, openQuestions: plan.questions },
    };
  },
};

export const getAgentDraftProvider = () => hostedProvider ? hostedAgentDraftProvider : localAgentDraftProvider;
