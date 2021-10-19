import mongoose, { Schema, Document } from 'mongoose';

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

// use these as the stages for photo requests
enum Stage {
  NEW = 1.1,
  IN_PROGRESS = 2.1,
  FULFILLED = 3.1,
}

// interface for each photo request
interface IPhotoRequest {
  name?: string;
  permissions: {
    teams?: GitHubTeamNodeID[];
    users: GitHubUserID[];
  };
  timestamps?: {
    created_at?: string; // ISO string
    modified_at?: string; // ISO string
  };
  people: {
    created_by?: GitHubUserID;
    modified_by?: GitHubUserID[];
    last_modified_by: GitHubUserID;
    requested_by?: GitHubUserID;
  };
  stage?: Stage;
  article_id?: string; // _id from article
  versions?: IPhotoRequest[]; // store previous versions of the request
  hidden?: boolean;
  history?: { type: string; user: GitHubUserID; at: string }[];
}

// create the schema for each field
// the record ensures that the keys are part of IPhotoRequest (values unknown)
const PhotoRequestSchemaFields: Record<keyof IPhotoRequest, unknown> = {
  name: { type: String, required: true, default: 'Photo Request' },
  permissions: {
    teams: { type: [String], default: [Groups.MANAGING_EDITOR] },
    users: { type: [Number] },
  },
  timestamps: {
    created_at: { type: Date, default: new Date().toISOString() },
    modified_at: { type: Date, default: new Date().toISOString() },
  },
  people: {
    created_by: { type: Number },
    modified_by: { type: [Number] },
    last_modified_by: { type: Number },
    requested_by: { type: Number },
  },
  stage: { type: Number, default: Stage.NEW },
  versions: { type: {} },
  article_id: { type: String, default: '' },
  hidden: { type: Boolean, default: false },
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
const PhotoRequestSchema = new Schema(PhotoRequestSchemaFields);

// create the model based on the schema
interface IPhotoRequestDoc extends IPhotoRequest, Document {} // combine the 2 interfaces
mongoose.model<IPhotoRequestDoc>('PhotoRequest', PhotoRequestSchema);

export { IPhotoRequest, IPhotoRequestDoc, Stage as EnumPhotoRequestStage };
