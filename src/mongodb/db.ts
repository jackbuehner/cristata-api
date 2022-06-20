import { merge } from 'merge-anything';
import mongoose from 'mongoose';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';
import passport from 'passport';
import passportLocalMongoose from 'passport-local-mongoose';
import { Configuration } from '../types/config';
import { slugify } from '../utils/slugify';
import { createTextIndex } from './createTextIndex';

mongoose.Schema.Types.String.checkRequired((v) => v !== null && v !== undefined);

// schema fields to include in every collection
const collectionSchemaFields = {
  timestamps: {
    created_at: { type: Date, required: true, default: new Date().toISOString() },
    modified_at: { type: Date, required: true, default: new Date().toISOString() },
  },
  people: {
    created_by: { type: mongoose.Schema.Types.ObjectId },
    modified_by: { type: [mongoose.Schema.Types.ObjectId] },
    last_modified_by: { type: mongoose.Schema.Types.ObjectId },
    watching: { type: [mongoose.Schema.Types.ObjectId] },
  },
  hidden: { type: Boolean, required: true, default: false },
  locked: { type: Boolean, required: true, default: false },
  history: [
    {
      type: { type: String, required: true },
      user: { type: mongoose.Schema.Types.ObjectId, required: true },
      at: {
        type: Date,
        required: true,
        default: new Date().toISOString(),
      },
    },
  ],
};

const publishableCollectionSchemaFields = {
  timestamps: {
    published_at: { type: Date, required: true, default: '0001-01-01T01:00:00.000+00:00' },
    updated_at: { type: Date, required: true, default: '0001-01-01T01:00:00.000+00:00' },
  },
  people: {
    published_by: { type: [mongoose.Schema.Types.ObjectId] },
    last_published_by: { type: mongoose.Schema.Types.ObjectId },
  },
};

const withPermissionsCollectionSchemaFields = {
  permissions: {
    teams: { type: [String] },
    users: { type: [mongoose.Schema.Types.ObjectId] },
  },
};

/**
 * For a mongoose schema input object, convert first level of nested objects
 * into subdocuments and return as a new object.
 *
 * _Does not mutate the input object._
 */
function convertTopNestedObjectsToSubdocuments(
  basicSchemaFields: Record<string, unknown>
): Record<string, unknown> {
  const complexSchemaFields = {};
  Object.entries(basicSchemaFields).forEach(([key, value]) => {
    // if the schema value is an object of properties, convert the object into a schema
    // (check !value.type to ensure that it is an object instead of a complex schema def)
    // (check !value.paths to ensure that it is an object intead of a mongoose schema)
    // (do not create _id for these schemas)
    // @ts-expect-error type and paths *might* be inside value
    if (Object.prototype.toString.call(value) === '[object Object]' && !value.type && !value.paths) {
      const SubSchema = new mongoose.Schema(value as { [key: string]: unknown }, { _id: false });
      complexSchemaFields[key] = { type: SubSchema, default: () => ({}) };
    } else {
      complexSchemaFields[key] = value;
    }
  });

  return complexSchemaFields;
}

async function db(database = `app`): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    console.clear();
    console.log(`\x1b[36mConnecting to the database...\x1b[0m`);
  }

  const username = process.env.MONGO_DB_USERNAME;
  const password = process.env.MONGO_DB_PASSWORD;
  const host = process.env.MONGO_DB_HOST;
  const options = `retryWrites=true&w=majority`;

  // connect to mongoDB
  if (username && password) {
    await mongoose.connect(`mongodb+srv://${username}:${password}@${host}/${database}?${options}`);
  } else {
    await mongoose.connect(`mongodb://127.0.0.1/${database}?${options}`);
  }
}

async function createMongooseModels(config: Configuration, tenant: string): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    console.log(`\x1b[36mCreating models for ${tenant}...\x1b[0m`);
  }

  const tenantDB = mongoose.connection.useDb(tenant, { useCache: true });

  // create the schema and model for each collection
  config.collections.forEach((collection) => {
    // merge preset schema fields per the config with fiels from the collection config
    const basicSchemaFields = merge(
      collectionSchemaFields,
      collection.schemaFields,
      collection.canPublish ? publishableCollectionSchemaFields : {},
      collection.withPermissions ? withPermissionsCollectionSchemaFields : {}
    );

    // convert first level of nested objects into subdocuments
    const complexSchemaFields = {};
    Object.entries(basicSchemaFields).forEach(([key, value]) => {
      // if the schema value is an object of properties, convert the object into a schema
      // (check !value.type to ensure that it is an object instead of a complex schema def)
      // (check !value.paths to ensure that it is an object intead of a mongoose schema)
      // (do not create _id for these schemas)
      // @ts-expect-error type and paths *might* be inside value
      if (Object.prototype.toString.call(value) === '[object Object]' && !value.type && !value.paths) {
        const SubSchema = new mongoose.Schema(value as { [key: string]: unknown }, { _id: false });
        complexSchemaFields[key] = { type: SubSchema, default: () => ({}) };
      } else {
        complexSchemaFields[key] = value;
      }
    });

    // create the schema
    const Schema = new mongoose.Schema(convertTopNestedObjectsToSubdocuments(basicSchemaFields));

    // add pagination to aggregation
    Schema.plugin(aggregatePaginate);

    // plugin passport-local-mongoose to the users collection
    if (collection.name === 'User')
      Schema.plugin(passportLocalMongoose, {
        saltlen: 36,
        iterations: 26000,
        keylen: 512,
        digestAlgorithm: 'sha256',
        interval: 100, // 0.1 seconds
        maxInterval: 30000, // 5 minutes
        usernameField: 'username',
        passwordField: 'password',
        usernameUnique: true,
        saltField: 'p_salt',
        hashField: 'p_hash',
        attemptsField: 'p_attempts',
        lastLoginField: 'p_last_login',
        selectFields: ['_id'], // fields to be provided to the serializer function
        usernameCaseInsensitive: false,
        usernameLowerCase: true,
        populateFields: undefined,
        encoding: 'hex',
        limitAttempts: false,
        usernameQueryFields: ['slug'],
      });

    // create the model based on the schema
    tenantDB.model(collection.name, Schema);

    // create text search index
    createTextIndex(collection, Schema, tenantDB);

    // activate the passport strategy for mongoose users
    if (collection.name === 'User') {
      passport.use(
        (tenantDB.model('User') as mongoose.PassportLocalModel<mongoose.Document>).createStrategy({ tenant })
      );
    }
  });

  // force a user with the name 'Unknown' and slug 'unknown-user-internal'
  await (async () => {
    const User = tenantDB.model('User');
    const unknownUserExists = !!(await User.findOne({ name: 'Unknown', slug: 'unknown-user-internal' }));
    if (!unknownUserExists) {
      const newUser = new User({
        _id: new mongoose.Types.ObjectId('000000000000000000000000'),
        name: 'Unknown',
        slug: 'unknown-user-internal',
        hidden: true,
        locked: true,
      });
      await newUser.save();
    }
  })();

  // force the following teams to exist
  type RequiredTeam = { name: string; slug: string; _id: mongoose.Types.ObjectId };
  const requiredTeams: RequiredTeam[] = [
    {
      name: 'Administrators',
      slug: 'admin',
      _id: new mongoose.Types.ObjectId('000000000000000000000001'),
    },
    {
      name: 'Managing Editors',
      slug: 'managing-editors',
      _id: new mongoose.Types.ObjectId('000000000000000000000003'),
    },
    ...(config.defaultTeams
      ?.filter((team) => team.id !== '000000000000000000000001')
      .filter((team) => team.slug !== 'admin')
      .filter((team) => team.id !== '000000000000000000000003')
      .filter((team) => team.slug !== 'managing-editors')
      .map((team): RequiredTeam => {
        return {
          name: team.name,
          slug: slugify(team.slug),
          _id: new mongoose.Types.ObjectId(team.id),
        };
      }) || ([] as RequiredTeam[])),
  ];

  const Team = tenantDB.model('Team');
  await Promise.all(
    requiredTeams.map(async (team) => {
      const exists = !!(await Team.findOne({ _id: team._id }));
      if (!exists) {
        const newTeam = new Team({
          _id: team._id,
          name: team.name,
          slug: team.slug,
        });
        await newTeam.save();
      }
    })
  );
}

type GitHubTeamNodeID = string;

interface CollectionSchemaFields {
  timestamps: {
    created_at: string; // ISO string
    modified_at: string; // ISO string
  };
  people: {
    created_by?: mongoose.Types.ObjectId;
    modified_by: mongoose.Types.ObjectId[]; // mongoose always returns at least an empty array
    last_modified_by?: mongoose.Types.ObjectId;
    watching: mongoose.Types.ObjectId[]; // mongoose always returns at least an empty array
  };
  hidden: boolean;
  locked: boolean;
  history: Array<{
    type: string;
    user: mongoose.Types.ObjectId;
    at: string; // ISO string
  }>;
}

interface WithPermissionsCollectionSchemaFields {
  permissions: {
    teams: GitHubTeamNodeID[];
    users: mongoose.Types.ObjectId[];
  };
}

interface PublishableCollectionSchemaFields {
  timestamps: {
    published_at: string; // ISO string
    updated_at: string; // ISO string
  };
  people: {
    published_by: mongoose.Types.ObjectId[]; // mongoose always returns at least an empty array
    last_published_by?: mongoose.Types.ObjectId;
  };
}

export {
  db,
  createMongooseModels,
  collectionSchemaFields,
  publishableCollectionSchemaFields,
  withPermissionsCollectionSchemaFields,
  convertTopNestedObjectsToSubdocuments,
};
export type {
  CollectionSchemaFields,
  WithPermissionsCollectionSchemaFields,
  PublishableCollectionSchemaFields,
  GitHubTeamNodeID,
};
