import mongoose, { Document, Schema } from 'mongoose';

export interface IProjectLink extends Document {
  project: mongoose.Types.ObjectId;
  addedBy: mongoose.Types.ObjectId;
  title: string;
  url: string;
  type: 'GitHub' | 'GitLab' | 'Bitbucket' | 'Google Drive' | 'OneDrive' | 'Figma' | 'Live Website' | 'Staging URL' | 'API Documentation' | 'Postman Collection' | 'Custom URL';
}

const projectLinkSchema = new Schema<IProjectLink>({
  project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String, required: true }
}, {
  timestamps: true
});

export default mongoose.model<IProjectLink>('ProjectLink', projectLinkSchema);
