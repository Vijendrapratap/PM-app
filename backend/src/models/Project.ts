import mongoose, { Document, Schema } from 'mongoose';
import { IUser } from './User';

export interface IProject extends Document {
  name: string;
  description: string;
  category: string;
  department?: string;
  status: 'Draft' | 'Saved' | 'Planning' | 'In Progress' | 'Review' | 'Testing' | 'Completed' | 'Cancelled' | 'On Hold';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  startDate?: Date;
  estimatedCompletionDate?: Date;
  deadline?: Date;
  budget?: number;
  owner: mongoose.Types.ObjectId | IUser;
  assignedMembers: (mongoose.Types.ObjectId | IUser)[];
  tags: string[];
  documents: {
    name: string;
    path: string;
    uploadedAt: Date;
  }[];
  progress: number;
  finalLinks?: {
    github?: string;
    googleDrive?: string;
    liveWebsite?: string;
  };
  finalNotes?: string;
  isLocked: boolean;
  completionDate?: Date;
}

const projectSchema = new Schema<IProject>({
  name: { type: String, required: true, unique: true },
  description: { type: String }, // Made optional for Drafts
  category: { type: String }, // Made optional for Drafts
  department: { type: String },
  status: { 
    type: String, 
    enum: ['Draft', 'Saved', 'Planning', 'In Progress', 'Review', 'Testing', 'Completed', 'Cancelled', 'On Hold'], 
    default: 'Draft' 
  },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
  startDate: { type: Date },
  estimatedCompletionDate: { type: Date },
  deadline: { type: Date },
  budget: { type: Number },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  assignedMembers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  tags: [{ type: String }],
  documents: [{
    name: { type: String },
    path: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  }],
  progress: { type: Number, default: 0 },
  finalLinks: {
    github: { type: String },
    googleDrive: { type: String },
    liveWebsite: { type: String }
  },
  finalNotes: { type: String },
  isLocked: { type: Boolean, default: false },
  completionDate: { type: Date }
}, {
  timestamps: true
});

export default mongoose.model<IProject>('Project', projectSchema);
