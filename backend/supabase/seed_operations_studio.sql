-- Pratap AI Operations Studio development workspace.
-- Run after migrations 0001–0018. All seeded accounts use: Demo@123
begin;

insert into users (organization_id,name,email,password_hash,role,platform_role,designation,department,department_id,timezone,account_status,onboarding_completed_at,status,availability)
select organization.id,seed.name,seed.email,crypt('Demo@123',gen_salt('bf')),seed.legacy_role,seed.platform_role,seed.designation,department.name,department.id,'Asia/Dubai','ACTIVE',now(),'Active','Available'
from organizations organization
cross join (values
  ('Vijendra Pratap Singh','vijendra@pratap.local','Super Admin','CEO','CEO','DEVELOPMENT'),
  ('Anush MK','anush@pratap.local','Lead','MANAGER','Tech Lead','DEVELOPMENT'),
  ('Govind','govind@pratap.local','Project Manager','MANAGER','Project Manager','DEVELOPMENT'),
  ('Priyanshu Rajbhar','priyanshu@pratap.local','Lead','MANAGER','CIO','DEVELOPMENT'),
  ('Devesh','devesh@pratap.local','Team Member','TEAM_MEMBER','Developer','DEVELOPMENT'),
  ('Saransh','saransh@pratap.local','Team Member','TEAM_MEMBER','Development Intern','DEVELOPMENT'),
  ('Disha','disha@pratap.local','Team Member','TEAM_MEMBER','Development Intern','DEVELOPMENT'),
  ('Satyam Tiwari','satyam@pratap.local','Project Manager','MANAGER','Sales Manager','SALES'),
  ('Sunny Singh','sunny@pratap.local','Team Member','TEAM_MEMBER','Sales Executive','SALES')
) seed(name,email,legacy_role,platform_role,designation,department_code)
join departments department on department.organization_id=organization.id and department.code=seed.department_code
where organization.name='Pratap AI'
on conflict (email) do update set name=excluded.name,platform_role=excluded.platform_role,designation=excluded.designation,department=excluded.department,department_id=excluded.department_id,onboarding_completed_at=excluded.onboarding_completed_at;

update users member set manager_user_id=manager.id
from users manager
join (values
  ('anush@pratap.local','vijendra@pratap.local'),
  ('govind@pratap.local','vijendra@pratap.local'),
  ('priyanshu@pratap.local','vijendra@pratap.local'),
  ('devesh@pratap.local','anush@pratap.local'),
  ('saransh@pratap.local','anush@pratap.local'),
  ('disha@pratap.local','anush@pratap.local'),
  ('satyam@pratap.local','vijendra@pratap.local'),
  ('sunny@pratap.local','satyam@pratap.local')
) reporting(member_email,manager_email) on manager.email=reporting.manager_email
where member.email=reporting.member_email;

insert into projects (organization_id,department_id,department,name,slug,objective,description,owner_id,created_by,status,canonical_status,health,priority,start_date,target_date,estimated_completion_date,progress)
select organization.id,department.id,department.name,seed.name,seed.slug,seed.objective,seed.objective,owner.id,creator.id,'In Progress','ACTIVE',seed.health,seed.priority::project_priority,current_date-21,current_date+seed.days,current_date+seed.days,seed.progress
from organizations organization
join users creator on creator.organization_id=organization.id and creator.email='vijendra@pratap.local'
join (values
  ('Vishvas Foundation','vishvas-foundation','Build and deliver the Vishvas Foundation digital platform.','DEVELOPMENT','govind@pratap.local','ON_TRACK','High',28,42),
  ('Competitor Analysis (Resort)','competitor-analysis-resort','Research resort competitors and turn findings into clear commercial actions.','SALES','satyam@pratap.local','ON_TRACK','Medium',18,35),
  ('Niko Salon Chatbot','niko-salon-chatbot','Deliver an AI chatbot for salon enquiries, bookings and customer support.','DEVELOPMENT','anush@pratap.local','AT_RISK','High',24,58),
  ('Real Estate Complete Module','real-estate-complete-module','Complete the real-estate workflow from listing and enquiry through follow-up.','DEVELOPMENT','govind@pratap.local','AT_RISK','Critical',35,63),
  ('Content Engine','content-engine','Create a governed engine for planning, producing and reviewing content.','MARKETING','priyanshu@pratap.local','ON_TRACK','High',30,47),
  ('Hermes + Obsidian Brain','hermes-obsidian-brain','Connect Hermes automation with an Obsidian-based organizational knowledge system.','DEVELOPMENT','priyanshu@pratap.local','ON_TRACK','High',32,31),
  ('AI Interviewer Platform','ai-interviewer-platform','Build an AI-assisted interview workflow with reviewable scoring and decisions.','DEVELOPMENT','anush@pratap.local','AT_RISK','Critical',40,54)
) seed(name,slug,objective,department_code,owner_email,health,priority,days,progress) on true
join departments department on department.organization_id=organization.id and department.code=seed.department_code
join users owner on owner.organization_id=organization.id and owner.email=seed.owner_email
where organization.name='Pratap AI'
on conflict (name) do update set objective=excluded.objective,department_id=excluded.department_id,department=excluded.department,owner_id=excluded.owner_id,health=excluded.health,priority=excluded.priority,progress=excluded.progress;

insert into project_members (project_id,user_id,project_role,permissions_json)
select project.id,member.id,case when member.platform_role='MANAGER' then 'MANAGER' else 'CONTRIBUTOR' end,
  case when member.platform_role='MANAGER' then '{"manageProject":true,"manageTasks":true}'::jsonb else '{}'::jsonb end
from (values
  ('Vishvas Foundation','govind@pratap.local'),('Vishvas Foundation','devesh@pratap.local'),('Vishvas Foundation','saransh@pratap.local'),
  ('Competitor Analysis (Resort)','satyam@pratap.local'),('Competitor Analysis (Resort)','sunny@pratap.local'),('Competitor Analysis (Resort)','govind@pratap.local'),
  ('Niko Salon Chatbot','anush@pratap.local'),('Niko Salon Chatbot','devesh@pratap.local'),('Niko Salon Chatbot','disha@pratap.local'),
  ('Real Estate Complete Module','govind@pratap.local'),('Real Estate Complete Module','anush@pratap.local'),('Real Estate Complete Module','devesh@pratap.local'),('Real Estate Complete Module','saransh@pratap.local'),('Real Estate Complete Module','disha@pratap.local'),
  ('Content Engine','priyanshu@pratap.local'),('Content Engine','govind@pratap.local'),
  ('Hermes + Obsidian Brain','priyanshu@pratap.local'),('Hermes + Obsidian Brain','anush@pratap.local'),('Hermes + Obsidian Brain','devesh@pratap.local'),
  ('AI Interviewer Platform','anush@pratap.local'),('AI Interviewer Platform','govind@pratap.local'),('AI Interviewer Platform','devesh@pratap.local'),('AI Interviewer Platform','disha@pratap.local')
) membership(project_name,email)
join projects project on project.name=membership.project_name
join users member on member.email=membership.email
on conflict (project_id,user_id) do update set project_role=excluded.project_role,permissions_json=excluded.permissions_json;

insert into milestones (project_id,name,description,sequence,owner_user_id,status,target_date)
select project.id,'Current delivery phase','The next measurable stage of delivery.',1,project.owner_id,'ACTIVE',project.target_date-7
from projects project
where not exists (select 1 from milestones milestone where milestone.project_id=project.id and milestone.name='Current delivery phase');

insert into deliverables (project_id,milestone_id,name,description,owner_user_id,status,target_date,acceptance_criteria_json)
select project.id,milestone.id,'Primary project outcome','The current reviewable project outcome.',project.owner_id,'ACTIVE',project.target_date-7,'["Output is reviewable","Owner and next action are visible"]'::jsonb
from projects project join milestones milestone on milestone.project_id=project.id and milestone.name='Current delivery phase'
where not exists (select 1 from deliverables deliverable where deliverable.milestone_id=milestone.id and deliverable.name='Primary project outcome');

insert into project_tasks (organization_id,project_id,milestone_id,deliverable_id,department_type,task_type,title,description,priority,status,canonical_status,blocked,assigned_to,created_by,reporter_user_id,reviewer_user_id,due_date,estimate_minutes)
select project.organization_id,project.id,milestone.id,deliverable.id,seed.department_type,seed.task_type,seed.title,seed.description,seed.priority,seed.status,seed.canonical_status,seed.blocked,assignee.id,creator.id,creator.id,reviewer.id,current_date+seed.due_days,seed.minutes
from (values
  ('Vishvas Foundation','DEVELOPMENT','Feature','Complete foundation dashboard flow','Finish the main beneficiary and program dashboard journey.','High','In Progress','IN_PROGRESS',false,'devesh@pratap.local','govind@pratap.local',0,240),
  ('Vishvas Foundation','DEVELOPMENT','Testing','Review responsive foundation pages','Validate the dashboard and forms on mobile breakpoints.','Medium','Pending','READY',false,'saransh@pratap.local','govind@pratap.local',2,120),
  ('Competitor Analysis (Resort)','SALES','Research','Complete resort competitor comparison','Compare positioning, pricing, channels and customer experience.','High','In Progress','IN_PROGRESS',false,'sunny@pratap.local','satyam@pratap.local',0,150),
  ('Competitor Analysis (Resort)','SALES','Client Update','Prepare resort opportunity summary','Turn the research into decisions and next commercial actions.','Medium','Pending','READY',false,'satyam@pratap.local','govind@pratap.local',2,90),
  ('Niko Salon Chatbot','DEVELOPMENT','Feature','Connect salon booking conversation','Complete the booking intent and confirmation workflow.','High','In Progress','IN_PROGRESS',false,'devesh@pratap.local','anush@pratap.local',0,210),
  ('Niko Salon Chatbot','DEVELOPMENT','Testing','Test fallback and escalation replies','Verify unclear enquiries reach a useful human handover.','Medium','Pending','READY',false,'disha@pratap.local','anush@pratap.local',1,120),
  ('Real Estate Complete Module','DEVELOPMENT','Bug','Resolve property enquiry assignment','Fix assignment so new enquiries reach the correct sales owner.','Critical','In Progress','IN_PROGRESS',true,'devesh@pratap.local','anush@pratap.local',0,180),
  ('Real Estate Complete Module','DEVELOPMENT','Feature','Complete listing approval workflow','Connect draft, review and publish states for property listings.','High','In Review','IN_REVIEW',false,'saransh@pratap.local','govind@pratap.local',1,240),
  ('Content Engine','MARKETING','Content','Prepare this week content plan','Confirm topics, formats, channels and approval owners.','High','In Progress','IN_PROGRESS',false,'priyanshu@pratap.local','govind@pratap.local',0,120),
  ('Content Engine','MARKETING','Approval','Review generated content batch','Approve, revise or reject drafts with clear reasons.','Medium','Pending','READY',false,'govind@pratap.local','priyanshu@pratap.local',1,90),
  ('Hermes + Obsidian Brain','DEVELOPMENT','Research','Define knowledge ingestion rules','Decide what Hermes may write and how Obsidian sources remain traceable.','High','In Progress','IN_PROGRESS',false,'priyanshu@pratap.local','anush@pratap.local',0,150),
  ('Hermes + Obsidian Brain','DEVELOPMENT','Feature','Build the first approved sync path','Sync one governed knowledge source into the Obsidian vault.','High','Pending','READY',false,'devesh@pratap.local','priyanshu@pratap.local',3,240),
  ('AI Interviewer Platform','DEVELOPMENT','Feature','Complete interview scoring workflow','Save evidence-linked scores and reviewer decisions.','Critical','In Progress','IN_PROGRESS',false,'devesh@pratap.local','anush@pratap.local',0,240),
  ('AI Interviewer Platform','DEVELOPMENT','Testing','Validate interview review permissions','Confirm reviewers only see and approve authorized interviews.','High','In Review','IN_REVIEW',false,'disha@pratap.local','anush@pratap.local',1,150)
) seed(project_name,department_type,task_type,title,description,priority,status,canonical_status,blocked,assignee_email,reviewer_email,due_days,minutes)
join projects project on project.name=seed.project_name
join milestones milestone on milestone.project_id=project.id and milestone.name='Current delivery phase'
join deliverables deliverable on deliverable.milestone_id=milestone.id and deliverable.name='Primary project outcome'
join users creator on creator.email='govind@pratap.local'
join users assignee on assignee.email=seed.assignee_email
join users reviewer on reviewer.email=seed.reviewer_email
where not exists (select 1 from project_tasks task where task.project_id=project.id and task.title=seed.title);

insert into blockers (organization_id,project_id,task_id,reported_by,summary,details,waiting_on_type,severity,status,suggested_next_action,resolution_owner_user_id)
select project.organization_id,project.id,task.id,devesh.id,'Property enquiry assignment is blocked','The current assignment rule needs an owner decision before final validation.','DECISION','HIGH','OPEN','Confirm the assignment rule and rerun the enquiry flow.',govind.id
from projects project join project_tasks task on task.project_id=project.id and task.title='Resolve property enquiry assignment'
join users devesh on devesh.email='devesh@pratap.local' join users govind on govind.email='govind@pratap.local'
where project.name='Real Estate Complete Module' and not exists (select 1 from blockers blocker where blocker.task_id=task.id and blocker.status in ('OPEN','IN_PROGRESS'));

-- Vijendra's personal operating rhythm. These live on the shared Tasks page
-- beside assigned project work, while retaining clear work-area and type labels.
insert into daily_todos (
  title,description,due_date,original_due_date,priority,status,assigned_to,created_by,
  domain_type,work_type,recurrence,scheduled_start,scheduled_end,meeting_with,channel
)
select seed.title,seed.description,current_date+seed.due_days,current_date+seed.due_days,seed.priority,'Pending',vijendra.id,vijendra.id,
  seed.domain_type,seed.work_type,seed.recurrence,
  case when seed.start_time is null then null else ((current_date+seed.due_days+seed.start_time::time) at time zone 'Asia/Dubai') end,
  case when seed.end_time is null then null else ((current_date+seed.due_days+seed.end_time::time) at time zone 'Asia/Dubai') end,
  seed.meeting_with,seed.channel
from users vijendra
cross join (values
  ('Publish LinkedIn post','Publish today''s business or product insight and respond to early engagement.','MARKETING','UPDATE','WEEKDAYS','High',0,'09:30',null,null,'LinkedIn'),
  ('Publish Twitter / X post','Share a concise insight from the current work.','MARKETING','UPDATE','DAILY','Medium',0,'11:30',null,null,'Twitter / X'),
  ('Contribute to a relevant Reddit discussion','Add useful context first; share a link only where it is genuinely relevant.','MARKETING','UPDATE','WEEKDAYS','Medium',0,'14:00',null,null,'Reddit'),
  ('Publish Instagram update','Adapt today''s strongest idea into a clear visual post or reel update.','MARKETING','UPDATE','WEEKDAYS','Medium',0,'18:00',null,null,'Instagram'),
  ('Reach out through LinkedIn DMs','Send thoughtful, relevant direct messages and record important replies.','MARKETING','TASK','WEEKDAYS','High',0,null,null,null,'LinkedIn'),
  ('Send targeted LinkedIn connection requests','Connect with people who match today''s relationship or business goal.','MARKETING','TASK','WEEKDAYS','Medium',0,null,null,null,'LinkedIn'),
  ('Send email outreach batch','Send the prepared email batch and capture replies requiring follow-up.','MARKETING','UPDATE','WEEKDAYS','High',0,'12:00',null,null,'Email'),
  ('Record short-form product video','Record one useful video that can be adapted for LinkedIn and Instagram.','MARKETING','TASK','WEEKLY','High',2,null,null,null,'LinkedIn + Instagram'),
  ('Move Pratap AI Operations Studio development forward','Review the current build, choose one shippable improvement and complete or clearly advance it.','DEVELOPMENT','TASK','DAILY','Critical',0,null,null,null,null),
  ('Daily leadership check-in','Review delivery risks, decisions and the next owner for each issue.','OPERATIONS','MEETING','WEEKDAYS','High',0,'10:00','10:30','Leadership team',null),
  ('Share daily leadership update','Summarize progress, blockers, decisions and tomorrow''s focus.','OPERATIONS','UPDATE','DAILY','High',0,'17:30',null,null,'Internal team')
) seed(title,description,domain_type,work_type,recurrence,priority,due_days,start_time,end_time,meeting_with,channel)
where vijendra.email='vijendra@pratap.local'
  and not exists (select 1 from daily_todos existing where existing.assigned_to=vijendra.id and existing.title=seed.title);

insert into ideas (organization_id,department_id,submitted_by,created_by,title,description,problem,status,category,business_value_score,strategic_alignment_score,urgency_score,delivery_effort_score,priority_score)
select organization.id,department.id,author.id,author.id,seed.title,seed.problem,seed.problem,seed.status,department.name,seed.value,seed.alignment,seed.urgency,seed.effort,(seed.value+seed.alignment+seed.urgency-seed.effort)
from organizations organization join (values
  ('Reusable chatbot intent library','Chatbot projects repeatedly rebuild common booking and support intents.','UNDER_REVIEW','DEVELOPMENT','disha@pratap.local',4,5,3,3),
  ('Automated competitor change watch','Resort competitor research becomes outdated quickly.','INBOX','SALES','sunny@pratap.local',4,4,4,3),
  ('Project knowledge handover pack','Project context is difficult to transfer between owners.','APPROVED','DEVELOPMENT','priyanshu@pratap.local',5,5,3,3)
) seed(title,problem,status,department_code,email,value,alignment,urgency,effort) on true
join departments department on department.organization_id=organization.id and department.code=seed.department_code
join users author on author.email=seed.email
where organization.name='Pratap AI' and not exists (select 1 from ideas idea where idea.organization_id=organization.id and idea.title=seed.title);

insert into workdays (organization_id,user_id,work_date,timezone,status,plan_status,focus,primary_outcome,check_in_at,started_at)
select user_account.organization_id,user_account.id,current_date,'Asia/Dubai','Open','ACTIVE','Complete the highest-priority development work','Ship a reviewable project outcome',now(),now()
from users user_account where user_account.email='devesh@pratap.local' on conflict (user_id,work_date) do nothing;

insert into workdays (organization_id,user_id,work_date,timezone,status,plan_status,focus,primary_outcome,check_in_at,started_at,check_out_at,closed_at,completed_summary,generated_summary)
select user_account.organization_id,user_account.id,current_date-1,'Asia/Dubai','Completed','CLOSED','Complete assigned testing','Finish the assigned testing flow',now()-interval '1 day',now()-interval '1 day',now()-interval '16 hours',now()-interval '16 hours','Completed testing and recorded the remaining review item.','Completed testing and recorded the remaining review item.'
from users user_account where user_account.email='disha@pratap.local' on conflict (user_id,work_date) do nothing;

insert into workday_items (workday_id,project_id,task_id,title,planned_outcome,status,source,order_index,end_state,carryover_count)
select workday.id,project.id,task.id,task.title,task.title,'Deferred','CARRYOVER',row_number() over(order by task.title),'CARRY_OVER',2
from workdays workday join users user_account on user_account.id=workday.user_id and user_account.email='disha@pratap.local'
join project_tasks task on task.assigned_to=user_account.id join projects project on project.id=task.project_id
where workday.work_date=current_date-1 and not exists (select 1 from workday_items item where item.workday_id=workday.id and item.task_id=task.id);

insert into agent_runs (project_id,organization_id,agent_type,status,trigger_event,provider,input_snapshot,output,created_by,started_at,completed_at)
select project.id,project.organization_id,'Project Manager','Ready for review','seed.project.plan','Seed provider','{}'::jsonb,'{"summary":"AI Interviewer delivery proposal"}'::jsonb,anush.id,now(),now()
from projects project join users anush on anush.email='anush@pratap.local' where project.name='AI Interviewer Platform'
and not exists (select 1 from agent_runs run where run.project_id=project.id and run.trigger_event='seed.project.plan');

insert into project_plan_versions (project_id,agent_run_id,version,status,content,created_by)
select project.id,run.id,1,'In review','{"summary":"AI Interviewer delivery proposal","assumptions":["Interview rubric will be approved"],"risks":["Scoring bias needs review"],"questions":["Who signs off the scoring rubric?"],"features":[]}'::jsonb,anush.id
from projects project join agent_runs run on run.project_id=project.id and run.trigger_event='seed.project.plan' join users anush on anush.email='anush@pratap.local'
where project.name='AI Interviewer Platform' and not exists (select 1 from project_plan_versions version where version.project_id=project.id and version.version=1);

insert into agent_proposals (agent_run_id,organization_id,project_id,proposal_type,summary,assumptions_json,actions_json,warnings_json,status,idempotency_key)
select run.id,project.organization_id,project.id,'PROJECT_PLAN','Review the AI Interviewer delivery structure.','["Interview rubric will be approved"]'::jsonb,jsonb_build_array(jsonb_build_object('type','PUBLISH_PLAN','planId',version.id)),'["Scoring bias needs review"]'::jsonb,'PENDING','seed-ai-interviewer-proposal'
from projects project join agent_runs run on run.project_id=project.id and run.trigger_event='seed.project.plan' join project_plan_versions version on version.agent_run_id=run.id
where project.name='AI Interviewer Platform' and not exists (select 1 from agent_proposals proposal where proposal.organization_id=project.organization_id and proposal.idempotency_key='seed-ai-interviewer-proposal');

insert into project_knowledge_documents (project_id,organization_id,document_type,title,created_by)
select project.id,project.organization_id,'BRD','AI Interviewer Business Requirements',govind.id from projects project join users govind on govind.email='govind@pratap.local' where project.name='AI Interviewer Platform'
on conflict (project_id,document_type) do nothing;

insert into project_knowledge_document_versions (document_id,version,status,content,structured_content,created_by,sources_json,missing_information_json,generated_by_agent)
select document.id,1,'In review','# AI Interviewer Business Requirements\n\n> AI-generated draft. Human approval required.\n\n## Confirmed Requirement\nInterview scores must link to review evidence.','{"classifications":[{"label":"Confirmed Requirement","text":"Interview scores link to review evidence"},{"label":"Open Question","text":"Confirm scoring-rubric approver"}]}'::jsonb,govind.id,jsonb_build_array(jsonb_build_object('type','PROJECT','id',document.project_id)),'["Confirm scoring-rubric approver"]'::jsonb,true
from project_knowledge_documents document join projects project on project.id=document.project_id and project.name='AI Interviewer Platform' join users govind on govind.email='govind@pratap.local'
where not exists (select 1 from project_knowledge_document_versions version where version.document_id=document.id and version.version=1);

commit;
