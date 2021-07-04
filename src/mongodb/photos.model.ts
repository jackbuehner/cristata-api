import mongoose, { Schema, Document } from 'mongoose';

type GitHubUserID = number;

// interface for each photo request
interface IPhoto {
  name?: string;
  timestamps?: {
    created_at?: string; // ISO string
    modified_at?: string; // ISO string
  };
  people: {
    photo_created_by?: string;
    uploaded_by?: GitHubUserID;
    modified_by?: GitHubUserID[];
    last_modified_by: GitHubUserID;
  };
  tags?: string[];
  file_type: string;
  photo_url: string;
  dimensions: {
    x: number;
    y: number;
  };
  versions?: IPhoto[]; // store previous versions
  hidden?: boolean;
  history?: { type: string; user: GitHubUserID }[];
}

// create the schema for each field
// the record ensures that the keys are part of IPhotoRequest (values unknown)
const PhotoSchemaFields: Record<keyof IPhoto, unknown> = {
  name: { type: String, required: true, default: 'Photo Request' },
  timestamps: {
    created_at: { type: Date, default: new Date().toISOString() },
    modified_at: { type: Date, default: new Date().toISOString() },
  },
  people: {
    photo_created_by: { type: String },
    uploaded_by: { type: Number },
    modified_by: { type: [Number] },
    last_modified_by: { type: Number },
  },
  tags: { type: [String] },
  file_type: { type: [String], default: undefined },
  photo_url: { type: String, default: '' },
  dimensions: {
    x: { type: Number },
    y: { type: Number },
  },
  versions: { type: {} },
  hidden: { type: Boolean, default: false },
  history: { type: { type: String, user: Number } },
};

// mongoose schema for each article
const PhotoSchema = new Schema(PhotoSchemaFields);

// create the model based on the schema
interface IPhotoDoc extends IPhoto, Document {} // combine the 2 interfaces
mongoose.model<IPhotoDoc>('Photo', PhotoSchema);

export { IPhoto, IPhotoDoc };
