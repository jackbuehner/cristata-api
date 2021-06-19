import mongoose, { Schema, Document } from 'mongoose';

// userID from GitHub is just a number
type GitHubUserID = number;

// permissions groups
enum Groups {
  ADMIN = 1,
  BOARD = 2,
  MANAGING_EDITOR = 3,
  COPY_EDITOR = 4,
  STAFF_WRITER = 5,
  CONTRIBUTOR = 6,
}

// use these as the stages for articles
enum Stage {
  PLANNING = 1.1,
  DRAFT = 2.1,
  PENDING_EDITOR_REVIEW = 3.1,
  PENDING_INTERVIEWEE_APPROVAL = 3.2,
  PENDING_EDIT = 3.4,
  PENDING_UPLOAD = 4.1,
  UPLOADED = 5.1,
  PUBLISHED = 5.2,
}

// interface for each article
interface IArticle {
  name?: string;
  permissions: {
    teams?: Groups[];
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
    editors?: {
      primary?: GitHubUserID;
      copy?: GitHubUserID[];
    };
  };
  stage?: Stage;
  categories?: string[];
  tags?: string[];
  description?: string;
  photo_path: string;
  photo_caption?: string;
}

// create the schema for each field
// the record ensures that the keys are part of IArticle (values unknown)
const ArticleSchemaFields: Record<keyof IArticle, unknown> = {
  name: { type: String, required: true, default: 'Article Title' },
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
    editors: {
      primary: { type: Number },
      copy: { type: Number },
    },
  },
  stage: { type: Number, default: Stage.PLANNING },
  categories: { type: [String], default: [''] },
  tags: { type: [String], default: [''] },
  description: { type: String, default: '' },
  photo_path: { type: String, default: '' },
  photo_caption: { type: String, default: '' },
};

// mongoose schema for each article
const ArticleSchema = new Schema(ArticleSchemaFields);

// create the model based on the schema
interface IArticleDoc extends IArticle, Document {} // combine the 2 interfaces
mongoose.model<IArticleDoc>('Article', ArticleSchema);

export { IArticle, IArticleDoc, Stage as EnumArticleStage };
