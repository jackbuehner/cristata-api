import mongoose, { Schema, Document } from 'mongoose';

type GitHubUserID = number;
type GitHubTeamNodeID = string;

interface IFlush {
  events?: {
    name: string;
    date: string; // ISO string
    location: string;
  }[];
  articles?: {
    featured?: mongoose.Types.ObjectId;
    more?: mongoose.Types.ObjectId[];
  };
  permissions: {
    teams: GitHubTeamNodeID[];
    users?: GitHubUserID[];
  };
  timestamps: {
    created_at: string; // ISO string
    modified_at: string; // ISO string
    published_at: string; // ISO string
    updated_at: string; // ISO string
    week: string; // ISO string
  };
  people: {
    created_by?: GitHubUserID;
    modified_by?: GitHubUserID[];
    last_modified_by: GitHubUserID;
    published_by?: GitHubUserID[];
    last_published_by?: GitHubUserID;
    watching?: GitHubUserID[];
  };
  volume?: number;
  issue?: number;
  left_advert_photo_url?: string;
  hidden: boolean;
  history?: { type: string; user: GitHubUserID; at: string }[];
}

// create the schema for each field
// the record ensures that the keys are part of IFlush (values unknown)
const FlushSchemaFields: Record<keyof IFlush, unknown> = {
  events: [
    {
      name: { type: String, default: '' },
      date: { type: Date, default: '0001-01-01T01:00:00.000+00:00' },
      location: { type: String, default: '' },
    },
  ],
  articles: {
    featured: mongoose.Types.ObjectId,
    more: [mongoose.Types.ObjectId],
  },
  permissions: {
    teams: { type: [String], default: ['T_kwDOBCVTT84AUIJM'] },
    users: { type: [Number] },
  },
  timestamps: {
    created_at: { type: Date, default: new Date().toISOString() },
    modified_at: { type: Date, default: new Date().toISOString() },
    published_at: { type: Date, default: '0001-01-01T01:00:00.000+00:00' },
    updated_at: { type: Date, default: '0001-01-01T01:00:00.000+00:00' },
    week: { type: Date, default: '0001-01-01T01:00:00.000+00:00' },
  },
  people: {
    created_by: { type: Number },
    modified_by: { type: [Number] },
    last_modified_by: { type: Number },
    published_by: { type: [Number] },
    last_published_by: { type: Number },
    watching: { type: [Number] },
  },
  hidden: { type: Boolean, default: false },
  volume: Number,
  issue: Number,
  left_advert_photo_url: String,
  history: [
    {
      type: { type: String },
      user: { type: Number },
      at: {
        type: Date,
        default: new Date().toISOString(),
      },
    },
  ],
};

// mongoose schema
const FlushSchema = new Schema(FlushSchemaFields);

// create the model based on the schema
interface IFlushDoc extends IFlush, Document {} // combine the 2 interfaces
mongoose.model<IFlushDoc>('Flush', FlushSchema);

export { IFlush, IFlushDoc };
