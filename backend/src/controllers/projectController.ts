import { Request, Response } from 'express';
import Project from '../models/Project';
import Update from '../models/Update';
import ActivityLog from '../models/ActivityLog';
import User from '../models/User';
import DailyReport from '../models/DailyReport';

const parseJsonArray = (value: unknown) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  if (typeof value !== 'string') return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const createProject = async (req: any, res: Response) => {
  try {
    const { name, description, category, department, priority, startDate, estimatedCompletionDate, deadline, budget, assignedMembers, tags, status } = req.body;
    
    // File uploads processing
    const files = req.files as Express.Multer.File[];
    const documents = files ? files.map(file => ({
      name: file.originalname,
      path: file.path
    })) : [];

    const projectExists = await Project.findOne({ name });
    if (projectExists) {
      return res.status(400).json({ message: 'Project name already taken' });
    }

    const parsedAssignedMembers = parseJsonArray(assignedMembers);
    const activeMembers = parsedAssignedMembers.length
      ? await User.find({ _id: { $in: parsedAssignedMembers }, status: 'Active' }).select('_id')
      : [];

    const project = await Project.create({
      name,
      description,
      category,
      department,
      priority: priority || 'Medium',
      startDate,
      estimatedCompletionDate,
      deadline,
      budget,
      status: status || 'Draft',
      assignedMembers: activeMembers.map(member => member._id),
      tags: parseJsonArray(tags),
      documents,
      owner: req.user ? req.user.id : '000000000000000000000000' // Mock if auth disabled
    });

    await ActivityLog.create({
      action: 'Project Created',
      user: req.user ? req.user.id : '000000000000000000000000',
      project: project._id,
      details: `Project ${project.name} was created.`
    });

    res.status(201).json(project);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getProjects = async (req: Request, res: Response) => {
  try {
    const projects = await Project.find().populate('assignedMembers', 'name email role phone department status photo').populate('owner', 'name');
    res.json(projects);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getProjectById = async (req: Request, res: Response) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('assignedMembers', 'name email role phone department status photo')
      .populate('owner', 'name');
      
    if (project) {
      res.json(project);
    } else {
      res.status(404).json({ message: 'Project not found' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getProjectDailyReports = async (req: Request, res: Response) => {
  try {
    const reports = await DailyReport.find({ projectId: req.params.id })
      .populate('member', 'name email role photo status')
      .populate('createdBy', 'name photo')
      .sort({ reportDate: 1, createdAt: 1 });

    res.json(reports);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const saveDailyReport = async (req: any, res: Response) => {
  try {
    const { reportDate, memberId, description } = req.body;
    if (!reportDate || !memberId || !description) {
      return res.status(400).json({ message: 'Report date, member and description are required' });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    if (project.status === 'Completed' || project.isLocked) {
      return res.status(400).json({ message: 'Project is completed and read-only' });
    }

    const member = await User.findById(memberId).select('_id name role status');
    if (!member) {
      return res.status(404).json({ message: 'Team member not found' });
    }

    const memberAssigned = project.assignedMembers.some(assigned => assigned.toString() === memberId);
    if (!memberAssigned) {
      return res.status(400).json({ message: 'Team member is not assigned to this project' });
    }

    const files = req.files as Express.Multer.File[];
    const documents = files ? files.map(file => ({
      name: file.originalname,
      path: file.path
    })) : [];
    const documentUrl = documents[0]?.path;

    const normalizedDate = new Date(reportDate);
    normalizedDate.setHours(0, 0, 0, 0);

    const existing = await DailyReport.findOne({
      projectId: project._id,
      teamMemberId: memberId,
      workDate: normalizedDate,
    });

    const mergedDocuments = existing ? [...existing.documents, ...documents] : documents;

    const report = await DailyReport.findOneAndUpdate(
      { projectId: project._id, teamMemberId: memberId, workDate: normalizedDate },
      {
        project: project._id,
        projectId: project._id,
        member: memberId,
        teamMemberId: memberId,
        teamMemberName: member.name,
        role: member.role,
        reportDate: normalizedDate,
        workDate: normalizedDate,
        description,
        documentUrl,
        documents: mergedDocuments,
        createdBy: req.user ? req.user.id : memberId,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate('member', 'name email role photo status').populate('createdBy', 'name photo');

    await ActivityLog.create({
      action: 'Daily Report Saved',
      user: req.user ? req.user.id : memberId,
      project: project._id,
      details: `Daily report saved for ${normalizedDate.toDateString()}`
    });

    res.status(201).json(report);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const addUpdate = async (req: any, res: Response) => {
  try {
    const { title, description, progress, status, comments, links } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    if (project.isLocked) {
      return res.status(400).json({ message: 'Project is locked and cannot be updated' });
    }

    const files = req.files as Express.Multer.File[];
    const documents = files ? files.map(file => ({
      name: file.originalname,
      path: file.path
    })) : [];

    const update = await Update.create({
      project: project._id,
      title,
      description,
      progress: Number(progress),
      status,
      comments,
      links: parseJsonArray(links),
      documents,
      createdBy: req.user ? req.user.id : '000000000000000000000000'
    });

    project.progress = Number(progress);
    project.status = status;
    await project.save();

    await ActivityLog.create({
      action: 'Project Updated',
      user: req.user ? req.user.id : '000000000000000000000000',
      project: project._id,
      details: `Project updated: ${title}`
    });

    res.status(201).json(update);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getProjectUpdates = async (req: Request, res: Response) => {
  try {
    const updates = await Update.find({ project: req.params.id }).populate('createdBy', 'name photo');
    res.json(updates);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const finishProject = async (req: any, res: Response) => {
  try {
    const { github, googleDrive, liveWebsite, finalNotes } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    project.status = 'Completed';
    project.isLocked = true;
    project.completionDate = new Date();
    project.finalLinks = { github, googleDrive, liveWebsite };
    project.finalNotes = finalNotes;
    project.progress = 100;

    await project.save();

    await ActivityLog.create({
      action: 'Project Completed',
      user: req.user?.id || '000000000000000000000000',
      project: project._id,
      details: `Project ${project.name} was marked as completed.`
    });

    res.json(project);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const validateCompletion = async (req: Request, res: Response) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    
    const errors: string[] = [];
    if (!project.name) errors.push('Project name is missing.');
    if (!project.description) errors.push('Project description is missing.');
    if (!project.assignedMembers || project.assignedMembers.length === 0) errors.push('At least one team member must be assigned.');
    if (project.startDate && project.estimatedCompletionDate && new Date(project.startDate) > new Date(project.estimatedCompletionDate)) {
      errors.push('Start date cannot be later than expected completion date.');
    }

    if (errors.length > 0) {
      return res.status(400).json({ valid: false, errors });
    }

    res.json({ valid: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
