/**
 * One-off migration: copies data from the old MongoDB database into the new
 * Supabase/Postgres schema, and re-uploads any local files under backend/uploads/
 * into Supabase Storage. Run once before cutover: `npm run migrate:data`.
 *
 * Requires MONGO_URI, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in backend/.env.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { MongoClient, ObjectId } from 'mongodb';
import { createClient } from '@supabase/supabase-js';

const MONGO_URI = process.env.MONGO_URI;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!MONGO_URI || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('MONGO_URI, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must all be set');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const UPLOADS_DIR = path.join(__dirname, '../uploads');
const BUCKET = 'project-files';

// Old Mongo ObjectId (string) -> new Postgres uuid
const idMap = new Map<string, string>();

const uploadLocalFile = async (localPath: string, folder: string): Promise<string | null> => {
  const absolutePath = path.join(UPLOADS_DIR, path.basename(localPath));
  if (!fs.existsSync(absolutePath)) {
    console.warn(`  ! missing local file, skipping: ${absolutePath}`);
    return null;
  }
  const storagePath = `${folder}/${path.basename(absolutePath)}`;
  const buffer = fs.readFileSync(absolutePath);
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, { upsert: true });
  if (error) {
    console.warn(`  ! failed to upload ${absolutePath}: ${error.message}`);
    return null;
  }
  return storagePath;
};

async function main() {
  const client = new MongoClient(MONGO_URI!);
  await client.connect();
  const db = client.db();
  console.log('Connected to MongoDB');

  // 1. Users
  const users = await db.collection('users').find().toArray();
  for (const u of users) {
    const { data, error } = await supabase
      .from('users')
      .insert({
        name: u.name,
        email: u.email,
        password_hash: u.password ?? null,
        role: u.role,
        department: u.department ?? 'General',
        phone: u.phone ?? null,
        skills: u.skills ?? [],
        status: u.status ?? 'Active',
        availability: u.availability ?? 'Available',
        photo: u.photo ?? null,
      })
      .select('id')
      .single();
    if (error) throw error;
    idMap.set(u._id.toString(), data.id);
  }
  console.log(`Migrated ${users.length} users`);

  // 2. Projects (+ members + initial documents)
  const projects = await db.collection('projects').find().toArray();
  for (const p of projects) {
    const ownerId = idMap.get(p.owner?.toString());
    if (!ownerId) {
      console.warn(`  ! skipping project "${p.name}" - owner not found in migrated users`);
      continue;
    }

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        name: p.name,
        description: p.description ?? null,
        category: p.category ?? null,
        department: p.department ?? null,
        status: p.status ?? 'Draft',
        priority: p.priority ?? 'Medium',
        start_date: p.startDate ?? null,
        estimated_completion_date: p.estimatedCompletionDate ?? null,
        deadline: p.deadline ?? null,
        budget: p.budget ?? null,
        owner_id: ownerId,
        tags: p.tags ?? [],
        progress: p.progress ?? 0,
        final_github: p.finalLinks?.github ?? null,
        final_google_drive: p.finalLinks?.googleDrive ?? null,
        final_live_website: p.finalLinks?.liveWebsite ?? null,
        final_notes: p.finalNotes ?? null,
        is_locked: p.isLocked ?? false,
        completion_date: p.completionDate ?? null,
      })
      .select('id')
      .single();
    if (error) throw error;
    idMap.set(p._id.toString(), project.id);

    const memberIds = (p.assignedMembers || [])
      .map((m: ObjectId) => idMap.get(m.toString()))
      .filter((id: string | undefined): id is string => Boolean(id));
    if (memberIds.length) {
      await supabase
        .from('project_members')
        .insert(memberIds.map((userId: string) => ({ project_id: project.id, user_id: userId })));
    }

    for (const doc of p.documents || []) {
      const storagePath = await uploadLocalFile(doc.path, `projects/${project.id}`);
      if (!storagePath) continue;
      await supabase
        .from('project_initial_documents')
        .insert({ project_id: project.id, name: doc.name, storage_path: storagePath });
    }
  }
  console.log(`Migrated ${projects.length} projects`);

  // 3. Updates (+ documents + links)
  const updates = await db.collection('updates').find().toArray();
  for (const u of updates) {
    const projectId = idMap.get(u.project?.toString());
    const createdBy = idMap.get(u.createdBy?.toString());
    if (!projectId || !createdBy) continue;

    const { data: update, error } = await supabase
      .from('updates')
      .insert({
        project_id: projectId,
        title: u.title,
        description: u.description,
        progress: u.progress,
        status: u.status,
        comments: u.comments ?? null,
        created_by: createdBy,
      })
      .select('id')
      .single();
    if (error) throw error;

    for (const doc of u.documents || []) {
      const storagePath = await uploadLocalFile(doc.path, `updates/${update.id}`);
      if (!storagePath) continue;
      await supabase.from('update_documents').insert({ update_id: update.id, name: doc.name, storage_path: storagePath });
    }
    for (const link of u.links || []) {
      await supabase.from('update_links').insert({ update_id: update.id, url: link.url, label: link.label ?? null });
    }
  }
  console.log(`Migrated ${updates.length} updates`);

  // 4. Daily reports (+ documents)
  const dailyReports = await db.collection('dailyreports').find().toArray();
  for (const r of dailyReports) {
    const projectId = idMap.get((r.projectId ?? r.project)?.toString());
    const memberId = idMap.get((r.teamMemberId ?? r.member)?.toString());
    const createdBy = idMap.get(r.createdBy?.toString()) ?? memberId;
    if (!projectId || !memberId || !createdBy) continue;

    const workDate = new Date(r.workDate).toISOString().slice(0, 10);
    const { data: report, error } = await supabase
      .from('daily_reports')
      .insert({
        project_id: projectId,
        member_id: memberId,
        team_member_name: r.teamMemberName,
        role: r.role,
        report_date: new Date(r.reportDate).toISOString().slice(0, 10),
        work_date: workDate,
        description: r.description,
        document_url: null,
        created_by: createdBy,
      })
      .select('id')
      .single();
    if (error) throw error;

    for (const doc of r.documents || []) {
      const storagePath = await uploadLocalFile(doc.path, `daily-reports/${projectId}`);
      if (!storagePath) continue;
      await supabase
        .from('daily_report_documents')
        .insert({ daily_report_id: report.id, name: doc.name, storage_path: storagePath });
    }
  }
  console.log(`Migrated ${dailyReports.length} daily reports`);

  // 5. Activity logs
  const activityLogs = await db.collection('activitylogs').find().toArray();
  for (const a of activityLogs) {
    const userId = idMap.get(a.user?.toString());
    const projectId = a.project ? idMap.get(a.project.toString()) : null;
    if (!userId) continue;
    await supabase.from('activity_logs').insert({
      action: a.action,
      user_id: userId,
      project_id: projectId,
      details: a.details,
    });
  }
  console.log(`Migrated ${activityLogs.length} activity logs`);

  await client.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
