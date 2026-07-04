import mongoose, { Document, Schema } from 'mongoose';

export interface IActivityLog extends Document {
  action: string;
  user: mongoose.Types.ObjectId;
  project?: mongoose.Types.ObjectId;
  details: string;
}

const activityLogSchema = new Schema<IActivityLog>({
  action: { type: String, required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  project: { type: Schema.Types.ObjectId, ref: 'Project' },
  details: { type: String, required: true }
}, {
  timestamps: true
});

export default mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);
