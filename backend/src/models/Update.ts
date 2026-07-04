import mongoose, { Document, Schema } from 'mongoose';

export interface IUpdate extends Document {
  project: mongoose.Types.ObjectId;
  title: string;
  description: string;
  progress: number;
  status: string;
  comments: string;
  documents: {
    name: string;
    path: string;
  }[];
  links: {
    url: string;
    label: string;
  }[];
  createdBy: mongoose.Types.ObjectId;
}

const updateSchema = new Schema<IUpdate>({
  project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  progress: { type: Number, required: true },
  status: { type: String, required: true },
  comments: { type: String },
  documents: [{
    name: { type: String },
    path: { type: String }
  }],
  links: [{
    url: { type: String },
    label: { type: String }
  }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
});

export default mongoose.model<IUpdate>('Update', updateSchema);
