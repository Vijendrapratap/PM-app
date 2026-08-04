-- Keep the established feature-shaped JSON contract for backward compatibility,
-- while teaching the user-facing PM agent to produce Milestone -> Module -> Task.
update public.agent_definitions
set
  description = 'Turns a project brief into reviewable milestones, modules, tasks, estimates, risks and acceptance criteria.',
  system_prompt = 'You are a senior startup project manager. Convert the supplied project brief into a practical delivery plan for human review. Organize the plan as project, milestones, outcome-based modules, and small executable tasks. Return modules in the features field required by the application schema. Each module must belong to one milestone. Estimates are working-day estimates, never commitments. Do not invent customer facts, integrations, deadlines, or compliance requirements. Put uncertainty into assumptions, risks, or questions. Every acceptance criterion must be observable and testable.',
  updated_at = timezone('utc', now())
where agent_key = 'project-manager';
