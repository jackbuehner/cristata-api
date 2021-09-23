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
  'Planning' = 1.1,
  'Draft' = 2.1,
  'Editor Review' = 3.1,
  'Copy Edit' = 3.3,
  'Writer/Editor Check' = 3.5,
  'Upload Approval' = 4.1,
  'Uploaded/Scheduled' = 5.1,
  'Published' = 5.2,
}

// interface for each article
interface IArticle {
  name?: string;
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
    target_publish_at?: string; // ISO string
  };
  people: {
    created_by?: GitHubUserID;
    modified_by?: GitHubUserID[];
    last_modified_by: GitHubUserID;
    published_by?: GitHubUserID[];
    authors?: GitHubUserID[];
    editors?: {
      primary?: GitHubUserID;
      copy?: GitHubUserID[];
    };
    watching?: GitHubUserID[];
  };
  stage?: Stage;
  categories?: string[];
  tags?: string[];
  description?: string;
  photo_path: string;
  video_path?: string;
  photo_caption?: string;
  body?: string;
  versions?: IArticle[]; // store previous versions of the article
  hidden?: boolean;
  show_comments: boolean;
  legacy_html: boolean; // true if it is html from the old webflow
  history?: { type: string; user: GitHubUserID; at: string }[];
}

// create the schema for each field
// the record ensures that the keys are part of IArticle (values unknown)
const ArticleSchemaFields: Record<keyof IArticle, unknown> = {
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
    target_publish_at: { type: Date, default: '0001-01-01T01:00:00.000+00:00' },
  },
  people: {
    created_by: { type: Number },
    modified_by: { type: [Number] },
    last_modified_by: { type: Number },
    published_by: { type: [Number] },
    last_published_by: { type: Number },
    authors: { type: [Number], default: [] },
    editors: {
      primary: { type: [Number] },
      copy: { type: [Number] },
    },
    watching: { type: [Number] },
  },
  stage: { type: Number, default: Stage.Planning },
  categories: { type: [String] },
  tags: { type: [String] },
  description: { type: String, default: '' },
  photo_path: { type: String, default: '' },
  video_path: { type: String, default: '' },
  photo_caption: { type: String, default: '' },
  body: { type: String },
  versions: { type: {} },
  hidden: { type: Boolean, default: false },
  show_comments: { type: Boolean, default: false },
  legacy_html: { type: Boolean, default: false },
  history: { type: { type: String, user: Number, at: { type: Date, default: new Date().toISOString() } } },
};

// mongoose schema for each article
const ArticleSchema = new Schema(ArticleSchemaFields);

// add pagination to aggregation
ArticleSchema.plugin(aggregatePaginate);

// create the model based on the schema
interface IArticleDoc extends IArticle, Document {} // combine the 2 interfaces
mongoose.model<IArticleDoc>('Article', ArticleSchema);

export { IArticle, IArticleDoc, Stage as EnumArticleStage };
