import mongoose, { Schema, Document } from 'mongoose';

type GitHubUserID = number;

// interface for each doc
interface IShortURL {
  original_url: string;
  code: string;
  domain: string;
  timestamps: {
    created_at: string; // ISO string
    modified_at: string; // ISO string
  };
  people: {
    created_by?: GitHubUserID;
    modified_by?: GitHubUserID[];
    last_modified_by: GitHubUserID;
  };
  hidden: boolean;
}

// create the schema for each field
// the record ensures that the keys are part of IUser (values unknown)
const ShortURLSchemaFields: Record<keyof IShortURL, unknown> = {
  original_url: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  domain: { type: String, required: true },
  timestamps: {
    created_at: { type: Date, default: new Date().toISOString() },
    modified_at: { type: Date, default: new Date().toISOString() },
  },
  people: {
    created_by: { type: Number },
    modified_by: { type: [Number] },
    last_modified_by: { type: Number },
  },
  hidden: { type: Boolean, default: false },
};

// mongoose schema for each doc
const ShortURLSchema = new Schema(ShortURLSchemaFields);

// create the model based on the schema
interface IShortURLDoc extends IShortURL, Document {} // combine the 2 interfaces
mongoose.model<IShortURLDoc>('ShortURL', ShortURLSchema);

export { IShortURL, IShortURLDoc };
