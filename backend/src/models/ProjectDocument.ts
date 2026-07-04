import mongoose, { Document, Schema } from 'mongoose';

export interface IProjectDocument extends Document {
  project: mongoose.Types.ObjectId;
  uploader: mongoose.Types.ObjectId;
  name: string;
  fileType: string;
  path: string;
  size?: number;
}

const projectDocumentSchema = new Schema<IProjectDocument>({
  project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  uploader: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  fileType: { type: String, required: true },
  path: { type: String, required: true },
  size: { type: Number }
}, {
  timestamps: true
});

export default mongoose.model<IProjectDocument>('ProjectDocument', projectDocumentSchema);
