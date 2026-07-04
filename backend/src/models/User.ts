import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: string;
  department?: string;
  phone?: string;
  skills: string[];
  status: 'Active' | 'Inactive';
  availability: 'Available' | 'Busy' | 'On Leave';
  photo?: string;
}

const userSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // For simplicity, if not using SSO
  role: { type: String, required: true },
  department: { type: String, default: 'General' },
  phone: { type: String },
  skills: [{ type: String }],
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  availability: { type: String, enum: ['Available', 'Busy', 'On Leave'], default: 'Available' },
  photo: { type: String }
}, {
  timestamps: true
});

export default mongoose.model<IUser>('User', userSchema);
