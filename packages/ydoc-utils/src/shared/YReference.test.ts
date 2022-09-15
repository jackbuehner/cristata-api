import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import * as Y from 'yjs';
import { YReference } from './YReference';

type UnpopulatedValue = { _id: string; label?: string; [key: string]: unknown };
type Doc = { _id: mongoose.Types.ObjectId; name: string; email: string };

describe(`shared >> YReference`, () => {
  const ydoc = new Y.Doc();
  let referenceType: YReference<string, (string | null | undefined)[] | UnpopulatedValue[] | undefined | null>;

  let mongoServer: MongoMemoryServer | undefined = undefined;
  let jack: Doc;
  let evan: Doc;
  let helena: Doc;
  let lauren: Doc;
  let scotty: Doc;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({ binary: { downloadDir: './cache/mongodb-binaries' } });
    await mongoose.connect(mongoServer.getUri(), {});

    // create schema
    const Schema = new mongoose.Schema({
      name: { type: 'String', required: true, default: 'New User' },
      email: { type: 'String' },
    });

    // create model
    const Model = mongoose.model('User', Schema);

    // create docs
    jack = await Model.create({ name: 'Jack Buehner', email: 'jack.buehner@thepaladin.news' });
    evan = await Model.create({ name: 'Evan Myers', email: 'evan.myers@thepaladin.news' });
    helena = await Model.create({ name: 'Helena Aarts', email: null });
    lauren = await Model.create({ name: 'Lauren Krotz', email: '' });
    scotty = await Model.create({ name: 'Scotty Bryan' });
  });

  afterAll(async () => {
    mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  const TenantModel = async (name: string) => {
    try {
      return mongoose.model(name);
    } catch (error) {
      return null;
    }
  };

  it('should create a new instance', async () => {
    referenceType = new YReference(ydoc);
    expect(referenceType).toBeInstanceOf(YReference);
  });

  describe('>> reference with default config', () => {
    it('should set with an array of ObjectIds and get an array of fake populated values', async () => {
      await referenceType.set('PLAIN_IDS', [jack._id.toHexString(), evan._id.toHexString()], TenantModel);
      const value = referenceType.get('PLAIN_IDS');
      expect(value).toMatchObject([
        { value: jack._id.toHexString(), label: jack._id.toHexString() },
        { value: evan._id.toHexString(), label: evan._id.toHexString() },
      ]);
    });

    it('should return empty array when empty array provided', async () => {
      await referenceType.set('EMPTY', [], TenantModel);
      const value = referenceType.get('EMPTY');
      expect(value).toMatchObject([]);
    });

    it('should return empty array when undefined is provided', async () => {
      await referenceType.set('UNDEFINED', undefined, TenantModel);
      const value = referenceType.get('UNDEFINED');
      expect(value).toMatchObject([]);
    });

    it('should return empty array when null is provided', async () => {
      await referenceType.set('NULL', null, TenantModel);
      const value = referenceType.get('NULL');
      expect(value).toMatchObject([]);
    });

    it('should return remove undefined and null values from array', async () => {
      await referenceType.set('UNDFNULL', [null, undefined, jack._id.toHexString()], TenantModel);
      const value = referenceType.get('UNDFNULL');
      expect(value).toMatchObject([{ value: jack._id.toHexString(), label: jack._id.toHexString() }]);
    });

    it('should return convert accept populated values', async () => {
      await referenceType.set(
        'UNDFNULL',
        [
          { _id: jack._id.toHexString(), label: jack.name },
          { _id: evan._id.toHexString(), label: evan.name },
        ],
        TenantModel
      );
      const value = referenceType.get('UNDFNULL');
      expect(value).toMatchObject([
        { value: jack._id.toHexString(), label: jack.name },
        { value: evan._id.toHexString(), label: evan.name },
      ]);
    });
  });

  describe('>> reference with reference config', () => {
    it('should convert ObjectIds to populated values with the default fields', async () => {
      await referenceType.set('PLAIN_IDS', [jack._id.toHexString(), evan._id.toHexString()], TenantModel, {
        collection: 'User',
      });
      const value = referenceType.get('PLAIN_IDS');
      expect(value).toMatchObject([
        { value: jack._id.toHexString(), label: jack.name },
        { value: evan._id.toHexString(), label: evan.name },
      ]);
    });

    it('should convert ObjectIds to populated values with custom fields', async () => {
      await referenceType.set('PIDC', [jack.name, evan.name], TenantModel, {
        collection: 'User',
        fields: {
          _id: 'name',
          name: 'email',
        },
      });
      const value = referenceType.get('PIDC');
      expect(value).toMatchObject([
        { value: jack.name, label: jack.email },
        { value: evan.name, label: evan.email },
      ]);
    });

    it('should convert ObjectIds to populated values with the forced fields included after the value and label field', async () => {
      await referenceType.set('PIDF', [jack._id.toHexString(), evan._id.toHexString()], TenantModel, {
        collection: 'User',
        forceLoadFields: ['email'],
      });
      const value = referenceType.get('PIDF');
      expect(value).toMatchObject([
        { value: jack._id.toHexString(), label: jack.name, email: jack.email },
        { value: evan._id.toHexString(), label: evan.name, email: evan.email },
      ]);
    });

    it('should use null if the force loaded field does not exist or has no value in the doc', async () => {
      await referenceType.set('PIDFU', [jack._id.toHexString(), evan._id.toHexString()], TenantModel, {
        collection: 'User',
        forceLoadFields: ['email_address'],
      });
      const value = referenceType.get('PIDFU');
      expect(value).toMatchObject([
        { value: jack._id.toHexString(), label: jack.name, email_address: null },
        { value: evan._id.toHexString(), label: evan.name, email_address: null },
      ]);
    });

    it('should convert ObjectIds to populated values and respect the reference filter', async () => {
      await referenceType.set('PIDFR', [jack._id.toHexString(), evan._id.toHexString()], TenantModel, {
        collection: 'User',
        filter: { name: { $ne: evan.name } },
      });
      const value = referenceType.get('PIDFR');
      expect(value).toMatchObject([{ value: jack._id.toHexString(), label: jack.name }]);
    });

    it('should convert ObjectIds to populated values and filter out docs where the required fields are missing, empty strings, or null', async () => {
      await referenceType.set(
        'PIDR',
        [
          jack._id.toHexString(),
          evan._id.toHexString(),
          helena._id.toHexString(),
          lauren._id.toHexString(),
          scotty._id.toHexString(),
        ],
        TenantModel,
        {
          collection: 'User',
          require: ['email'],
        }
      );
      const value = referenceType.get('PIDR');
      expect(value).toMatchObject([
        { value: jack._id.toHexString(), label: jack.name },
        { value: evan._id.toHexString(), label: evan.name },
      ]);
    });

    it('should convert ObjectIds to empty array when collection model is null', async () => {
      await referenceType.set('PIDUM', [jack._id.toHexString(), evan._id.toHexString()], TenantModel, {
        collection: 'FakeUser',
      });
      const value = referenceType.get('PIDUM');
      expect(value).toMatchObject([]);
    });
  });

  describe('>> existence', () => {
    it('should return true when checking presence of an existing key-value pair', async () => {
      await referenceType.set('EXISTING', ['reference_identifier'], TenantModel);
      const value = referenceType.has('EXISTING');
      expect(value).toBe(true);
    });

    it('should return false when checking presence of a missing key-value pair', async () => {
      const value = referenceType.has('MISSING_NUMBER');
      expect(value).toBe(false);
    });
  });

  describe('>> removal', () => {
    it('should successfully remove a key-value pair', async () => {
      await referenceType.set('TO_REMOVE', ['reference_identifier'], TenantModel);
      expect(referenceType.has('TO_REMOVE')).toBe(true);

      referenceType.delete('TO_REMOVE');
      expect(referenceType.has('TO_REMOVE')).toBe(false);
    });

    it('should do nothing on attempt to remove a missing key-value pair', async () => {
      expect(referenceType.has('TO_REMOVE_MISSING')).toBe(false);

      referenceType.delete('TO_REMOVE_MISSING');
      expect(referenceType.has('TO_REMOVE_MISSING')).toBe(false);
    });
  });
});
