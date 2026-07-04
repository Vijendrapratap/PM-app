import mongoose, { Document, Schema } from 'mongoose';

export interface IProjectComment extends Document {
  project: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  comment: string;
  attachment?: string;
  replies: {
    user: mongoose.Types.ObjectId;
    comment: string;
    createdAt: Date;
  }[];
}

const projectCommentSchema = new Schema<IProjectComment>({
  project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  comment: { type: String, required: true },
  attachment: { type: String },
  replies: [{
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    comment: { type: String },
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

export default mongoose.model<IProjectComment>('ProjectComment', projectCommentSchema);
