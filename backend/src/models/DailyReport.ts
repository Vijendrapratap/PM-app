import mongoose, { Document, Schema } from 'mongoose';

export interface IDailyReport extends Document {
  project: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  member: mongoose.Types.ObjectId;
  teamMemberId: mongoose.Types.ObjectId;
  teamMemberName: string;
  role: string;
  reportDate: Date;
  workDate: Date;
  description: string;
  documentUrl?: string;
  documents: {
    name: string;
    path: string;
  }[];
  createdBy: mongoose.Types.ObjectId;
}

const dailyReportSchema = new Schema<IDailyReport>({
  project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  member: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  teamMemberId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  teamMemberName: { type: String, required: true },
  role: { type: String, required: true },
  reportDate: { type: Date, required: true, index: true },
  workDate: { type: Date, required: true, index: true },
  description: { type: String, required: true },
  documentUrl: { type: String },
  documents: [{
    name: { type: String },
    path: { type: String },
  }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, {
  timestamps: true,
});

dailyReportSchema.index({ projectId: 1, workDate: 1, teamMemberId: 1 }, { unique: true });

export default mongoose.model<IDailyReport>('DailyReport', dailyReportSchema);