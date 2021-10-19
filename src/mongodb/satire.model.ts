import mongoose, { Schema, Document } from 'mongoose';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';

type GitHubUserID = number;
type GitHubTeamNodeID = string;

// permissions groups
enum Groups {
  ADMIN = 'MDQ6VGVhbTQ2NDI0MTc=',
  BOARD = 'MDQ6VGVhbTQ3MzA5ODU=',
  MANAGING_EDITOR = 'MDQ6VGVhbTQ5MDMxMTY=',
  COPY_EDITOR = 'MDQ6VGVhbTQ4MzM5MzU=',
  STAFF_WRITER = 'MDQ6VGVhbTQ5MDMxMTg=',
  CONTRIBUTOR = 'MDQ6VGVhbTQ5MDMxMjA=',
}

// use these as the stages for articles
enum Stage {
  PLANNING = 1.1,
  DRAFT = 2.1,
  PENDING_EDIT = 3.4,
  PENDING_UPLOAD = 4.1,
  UPLOADED = 5.1,
  PUBLISHED = 5.2,
}

// interface for each article
interface ISatire {
  name: string;
  slug: string;
  permissions: {
    teams?: GitHubTeamNodeID[];
    users: GitHubUserID[];
  };
  locked?: boolean;
  timestamps?: {
    created_at?: string; // ISO string
    modified_at?: string; // ISO string
    published_at?: string; // ISO string
    updated_at?: string; // ISO string
    target_publish_at?: string; // ISO string
  };
  people: {
    created_by?: GitHubUserID;
    modified_by?: GitHubUserID[];
    last_modified_by: GitHubUserID;
    published_by?: GitHubUserID[];
    authors?: GitHubUserID[];
    display_authors: string[];
    editors?: {
      primary?: GitHubUserID;
      copy?: GitHubUserID[];
    };
  };
  stage?: Stage;
  tags?: string[];
  description?: string;
  photo_path: string;
  photo_credit: string;
  photo_caption?: string;
  body?: string;
  versions?: ISatire[]; // store previous versions of the article
  hidden?: boolean;
  legacy_html: boolean; // true if it is html from the old webflow
  history?: { type: string; user: GitHubUserID; at: string }[];
}

// create the schema for each field
// the record ensures that the keys are part of ISatire (values unknown)
const SatireSchemaFields: Record<keyof ISatire, unknown> = {
  name: { type: String, required: true, default: 'Article Title' },
  slug: { type: String },
  permissions: {
    teams: { type: [String], default: [Groups.MANAGING_EDITOR] },
    users: { type: [Number] },
  },
  locked: { type: Boolean, default: false },
  timestamps: {
    created_at: { type: Date, default: new Date().toISOString() },
    modified_at: { type: Date, default: new Date().toISOString() },
    published_at: { type: Date, default: '0001-01-01T01:00:00.000+00:00' },
    updated_at: { type: Date, default: '0001-01-01T01:00:00.000+00:00' },
    target_publish_at: { type: Date, default: '0001-01-01T01:00:00.000+00:00' },
  },
  people: {
    created_by: { type: Number },
    modified_by: { type: [Number] },
    last_modified_by: { type: Number },
    published_by: { type: [Number] },
    last_published_by: { type: Number },
    authors: { type: [Number], default: [] },
    display_authors: { type: [String], default: [] },
    editors: {
      primary: { type: [Number] },
      copy: { type: [Number] },
    },
  },
  stage: { type: Number, default: Stage.PLANNING },
  tags: { type: [String] },
  description: { type: String, default: '' },
  photo_path: { type: String, default: '' },
  photo_credit: { type: String, default: '' },
  photo_caption: { type: String, default: '' },
  body: { type: String },
  versions: { type: {} },
  hidden: { type: Boolean, default: false },
  legacy_html: { type: Boolean, default: false },
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

// mongoose schema for each article
const SatireSchema = new Schema(SatireSchemaFields);

// add pagination to aggregation
SatireSchema.plugin(aggregatePaginate);

// create the model based on the schema
interface ISatireDoc extends ISatire, Document {} // combine the 2 interfaces
mongoose.model<ISatireDoc>('Satire', SatireSchema);

export { ISatire, ISatireDoc, Stage as EnumSatireStage };
