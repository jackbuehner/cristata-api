import mongoose, { Schema, Document } from 'mongoose';
import { slugify } from '../utils/slugify';

type GitHubUserID = number;
type GitHubTeamNodeID = string;

// interface for each user profile
interface IUser {
  name: string;
  slug: string;
  phone: number;
  email: string;
  twitter: string;
  biography: string;
  current_title: string;
  timestamps: {
    created_at: string; // ISO string
    modified_at: string; // ISO string
    joined_at?: string; // ISO string
    left_at?: string; // ISO string
    last_login_at?: string; // ISO string
  };
  people: {
    created_by?: GitHubUserID;
    modified_by?: GitHubUserID[];
    last_modified_by: GitHubUserID;
  };
  photo: string; // url to photo
  versions: IUser[]; // store previous versions of the user profile
  github_id: GitHubUserID;
  teams: GitHubTeamNodeID[];
  group?: number;
}

// create the schema for each field
// the record ensures that the keys are part of IUser (values unknown)
const UserSchemaFields: Record<keyof IUser, unknown> = {
  name: { type: String, required: true, default: 'New User' },
  slug: { type: String, required: true, default: slugify('New User') },
  phone: { type: Number },
  email: { type: String },
  twitter: { type: String },
  biography: { type: String },
  current_title: { type: String },
  timestamps: {
    created_at: { type: Date, default: new Date().toISOString() },
    modified_at: { type: Date, default: new Date().toISOString() },
    joined_at: { type: Date, default: '0001-01-01T01:00:00.000+00:00' },
    left_at: { type: Date, default: '0001-01-01T01:00:00.000+00:00' },
    last_login_at: { type: Date, default: new Date().toISOString() },
  },
  people: {
    created_by: { type: Number },
    modified_by: { type: [Number] },
    last_modified_by: { type: Number },
  },
  photo: { type: String },
  versions: { type: {} },
  github_id: { type: Number },
  teams: { type: [String] },
  group: { type: Number, default: '5.10' },
};

// mongoose schema for each article
const UserSchema = new Schema(UserSchemaFields);

// create the model based on the schema
interface IUserDoc extends IUser, Document {} // combine the 2 interfaces
mongoose.model<IUserDoc>('User', UserSchema);

export { IUser, IUserDoc };
