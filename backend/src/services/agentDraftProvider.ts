import { ProjectPlanContent } from '../types/models';

export interface ProjectContext {
  name: string;
  description?: string | null;
  category?: string | null;
  department?: string | null;
  deadline?: string | null;
  tags?: string[];
}

const task = (key: string, title: string, description: string, estimateDays: number, acceptanceCriteria: string[]) => ({
  key, title, description, estimateDays, priority: 'Medium' as const, acceptanceCriteria,
});

export const localAgentDraftProvider = {
  name: 'Local structured provider',

  createProjectPlan(project: ProjectContext): ProjectPlanContent {
    const product = project.name;
    const description = project.description?.trim() || `Deliver the agreed outcome for ${product}.`;
    const isWeb = /web|site|portal|dashboard|saas|app/i.test(`${project.category || ''} ${description}`);

    return {
      summary: `A delivery plan for ${product} that moves from clarified scope through an approved, tested release. The plan uses estimate ranges as a starting point for Govind's review, not as a fixed commitment.`,
      assumptions: [
        'A named stakeholder can answer scope questions during planning.',
        'The assigned team has access to required systems, content, and credentials.',
        project.deadline ? `The requested deadline is ${project.deadline}; sequencing must be confirmed against team capacity.` : 'A delivery deadline will be agreed after scope review.',
      ],
      risks: [
        'Unresolved requirements may change scope after implementation begins.',
        'External approvals, credentials, or content can block otherwise executable work.',
        'Estimates will change when technical unknowns are resolved.',
      ],
      questions: [
        'Who is the final business approver for scope and acceptance?',
        'Which user journey must work first for the initial release?',
        'What integrations, data sources, and compliance constraints are mandatory?',
      ],
      features: [
        {
          key: 'discovery-alignment', title: 'Discovery and scope alignment',
          outcome: 'The team shares one testable definition of the problem, users, scope, and success.',
          description, acceptanceCriteria: ['Primary users and their needs are documented', 'In-scope and out-of-scope boundaries are approved', 'Success measures and open questions have owners'],
          priority: 'High', estimateDays: 3, confidence: 'High',
          tasks: [
            task('discovery-stakeholders', 'Confirm stakeholders and decision owners', 'Identify who provides input, who reviews, and who approves the project outcome.', 0.5, ['Decision owner is named', 'Review cadence is agreed']),
            task('discovery-requirements', 'Capture requirements and constraints', 'Turn the project brief into functional needs, constraints, assumptions, and open questions.', 1.5, ['Requirements are written in testable language', 'Unknowns are assigned']),
            task('discovery-scope', 'Approve initial scope and success measures', 'Review the first delivery boundary before implementation planning is locked.', 1, ['Scope has explicit inclusions and exclusions', 'Success measures are approved']),
          ],
        },
        {
          key: 'solution-foundation', title: isWeb ? 'Experience and solution foundation' : 'Solution foundation',
          outcome: 'The team has an agreed structure, primary flow, and implementation approach.',
          description: 'Translate approved requirements into the smallest coherent solution that can be built and reviewed.',
          acceptanceCriteria: ['Primary workflow is mapped end to end', 'Data and integration boundaries are identified', 'Reviewable solution direction is approved'],
          priority: 'High', estimateDays: isWeb ? 6 : 5, confidence: 'Medium',
          tasks: [
            task('foundation-flow', 'Map the primary user workflow', 'Define entry points, decisions, success path, and recovery states.', 1.5, ['Happy path is complete', 'Empty and failure states are included']),
            task('foundation-design', isWeb ? 'Create the reviewable interface direction' : 'Create the reviewable solution design', 'Produce the structure and interaction or system design required for implementation.', 2, ['Stakeholders can review the proposed solution', 'Design decisions trace to requirements']),
            task('foundation-architecture', 'Confirm implementation and data approach', 'Document components, data ownership, integrations, environments, and key risks.', 2.5, ['Technical approach is reviewable', 'Integration dependencies are named']),
          ],
        },
        {
          key: 'core-delivery', title: 'Core delivery',
          outcome: 'The approved primary workflow works in a review environment with meaningful data.',
          description: 'Implement the core outcome in small reviewable increments and keep task state tied to acceptance criteria.',
          acceptanceCriteria: ['Primary workflow works end to end', 'Access and validation rules are enforced', 'Stakeholders can review a deployed or runnable increment'],
          priority: 'Critical', estimateDays: 10, confidence: 'Medium',
          tasks: [
            task('delivery-foundation', 'Build the delivery foundation', 'Set up the core structure, environments, shared components, and data contracts.', 3, ['Project runs in the target environment', 'Core data contract is implemented']),
            task('delivery-primary-flow', 'Implement the primary workflow', 'Build the highest-value user or business flow against the approved acceptance criteria.', 5, ['Primary acceptance criteria pass', 'Errors are handled clearly']),
            task('delivery-review', 'Prepare stakeholder review increment', 'Add representative data, review notes, and a clear path for feedback.', 2, ['Review environment is accessible', 'Known gaps are documented']),
          ],
        },
        {
          key: 'quality-release', title: 'Quality, release, and handover',
          outcome: 'The agreed release is verified, documented, approved, and supportable.',
          description: 'Validate the end-to-end outcome, resolve release blockers, and complete operational handover.',
          acceptanceCriteria: ['Critical acceptance criteria pass', 'Release blockers are resolved or explicitly accepted', 'Documentation and ownership are handed over'],
          priority: 'High', estimateDays: 5, confidence: 'Medium',
          tasks: [
            task('quality-validation', 'Run acceptance and regression checks', 'Test primary, failure, permission, and responsive paths against the approved plan.', 2, ['Critical tests pass', 'Defects have severity and owners']),
            task('quality-fixes', 'Resolve release blockers', 'Fix or explicitly accept issues that prevent the intended outcome.', 2, ['No unresolved critical blocker remains', 'Accepted risks are recorded']),
            task('quality-handover', 'Complete documentation and release handover', 'Publish approved documentation, links, ownership, and next-step notes.', 1, ['Required documents are approved', 'Operational owner is named']),
          ],
        },
      ],
    };
  },

  createBusinessRequirementsDocument(project: ProjectContext, plan: ProjectPlanContent) {
    const featureSections = plan.features.map((feature, index) => [
      `## ${index + 1}. ${feature.title}`,
      '',
      `**Business outcome:** ${feature.outcome}`,
      '',
      feature.description,
      '',
      '**Acceptance criteria**',
      ...feature.acceptanceCriteria.map((criterion) => `- ${criterion}`),
      '',
      '**Executable work**',
      ...feature.tasks.map((item) => `- ${item.title} — ${item.description} (${item.estimateDays} day estimate)`),
    ].join('\n')).join('\n\n');

    const content = [
      `# Business Requirements Document — ${project.name}`,
      '',
      '> Agent draft. Govind must review and approve this version before it becomes project guidance.',
      '',
      '## Project overview', '', project.description?.trim() || plan.summary,
      '', '## Purpose and expected outcome', '', plan.summary,
      '', '## Scope assumptions', ...plan.assumptions.map((item) => `- ${item}`),
      '', '## Functional requirements', '', featureSections,
      '', '## Non-functional requirements',
      '- Access must follow project and role permissions.',
      '- Meaningful changes must be traceable to a person or agent run.',
      '- Primary workflows must include loading, empty, validation, and failure states.',
      '- The delivered solution must be usable on supported desktop and mobile widths.',
      '', '## Risks', ...plan.risks.map((item) => `- ${item}`),
      '', '## Open questions', ...plan.questions.map((item) => `- ${item}`),
      '', '## Approval', '', 'Status: Waiting for review', '', 'Approver: Govind / Project Manager',
    ].join('\n');

    return { content, structuredContent: { summary: plan.summary, featureCount: plan.features.length, openQuestions: plan.questions } };
  },
};
