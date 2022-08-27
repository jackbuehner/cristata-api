import { Model } from 'mongoose';
import { useApolloContext, useMongoose } from '../../../../tests/hooks';
import { findDoc } from './findDoc';

describe(`api >> v3 >> helpers >> findDoc`, () => {
  const { mongoose, createModel } = useMongoose();

  // name of the collection to use in these tests
  const colName = 'Document';

  // reset the argument to pass into useApolloContext between each test
  let c: Parameters<typeof useApolloContext>[0];
  beforeEach(() => {
    c = {
      isAuthenticated: true,
      collection: {
        name: colName,
        withPermissions: true,
        actionAccess: {
          get: { users: [0], teams: [0] },
          create: { users: [0], teams: [0] },
          modify: { users: [0], teams: [0] },
          hide: { users: [0], teams: [0] },
          lock: { users: [0], teams: [0] },
          archive: { users: [0], teams: [0] },
          watch: { users: [0], teams: [0] },
          delete: { users: [0], teams: [0] },
        },
      },
    };
  });

  it('should find a doc in a collection without standard permissions', async () => {
    // do not use standard permissions
    c.collection.withPermissions = false;

    // create the model and context
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    await newDoc.save();

    // find the doc
    const found = await findDoc({ model: colName, _id: newDoc._id, context });
    expect(found).toHaveProperty('_id', newDoc._id);

    // cleanup
    await newDoc.delete();
  });

  it('should fail to find a doc with empty permissions', async () => {
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    await newDoc.save();

    // find the doc
    const found = await findDoc({ model: colName, _id: newDoc._id, context });
    expect(found).toBeUndefined();

    // cleanup
    await newDoc.delete();
  });

  it('should find a doc with empty permissions when `fullAccess === true`', async () => {
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    await newDoc.save();

    // find the doc
    const found = await findDoc({ model: colName, _id: newDoc._id, context, fullAccess: true });
    expect(found).toHaveProperty('_id', newDoc._id);

    // cleanup
    await newDoc.delete();
  });

  it('should find a doc with empty permissions when authenticated user is an admin', async () => {
    // make user an admin
    c.isAdmin = true;

    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    await newDoc.save();

    // find the doc
    const found = await findDoc({ model: colName, _id: newDoc._id, context });
    expect(found).toHaveProperty('_id', newDoc._id);

    // cleanup
    await newDoc.delete();
  });

  it('should find a doc with empty permissions when current user can bypass permissions', async () => {
    // allow current user to pypass document permissions
    c.collection.actionAccess.bypassDocPermissions = { users: ['000000000000000000000001'], teams: [] }; // 000000000000000000000001 is the test user's id

    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    await newDoc.save();

    // find the doc
    const found = await findDoc({ model: colName, _id: newDoc._id, context });
    expect(found).toHaveProperty('_id', newDoc._id);

    // cleanup
    await newDoc.delete();
  });

  it('should find a doc with empty permissions when custom access rule is empty object', async () => {
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    await newDoc.save();

    // find the doc
    const found = await findDoc({ model: colName, _id: newDoc._id, context, accessRule: {} });
    expect(found).toHaveProperty('_id', newDoc._id);

    // cleanup
    await newDoc.delete();
  });

  it(`should find a doc with one of user's teams in permissions`, async () => {
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    newDoc.set('permissions.teams', ['000000000000000000000099']); // test user is in team '000000000000000000000099'
    await newDoc.save();

    // find the doc
    const found = await findDoc({ model: colName, _id: newDoc._id, context });
    expect(found).toHaveProperty('_id', newDoc._id);

    // cleanup
    await newDoc.delete();
  });

  it(`should find a doc with user's _id in permissions`, async () => {
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    newDoc.set('permissions.users', [new mongoose.Types.ObjectId('000000000000000000000001')]); // test user's _id is '000000000000000000000001'
    await newDoc.save();

    // find the doc
    const found = await findDoc({ model: colName, _id: newDoc._id, context });
    expect(found).toHaveProperty('_id', newDoc._id);

    // cleanup
    await newDoc.delete();
  });

  it(`should find a doc with team 0 (any team)`, async () => {
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    newDoc.set('permissions.teams', [0]);
    await newDoc.save();

    // find the doc
    const found = await findDoc({ model: colName, _id: newDoc._id, context });
    expect(found).toHaveProperty('_id', newDoc._id);

    // cleanup
    await newDoc.delete();
  });

  it(`should find a doc with team "0" (any team)`, async () => {
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    newDoc.set('permissions.teams', ['0']);
    await newDoc.save();

    // find the doc
    const found = await findDoc({ model: colName, _id: newDoc._id, context });
    expect(found).toHaveProperty('_id', newDoc._id);

    // cleanup
    await newDoc.delete();
  });

  it(`should find a doc with user "000000000000000000000000" (any user)`, async () => {
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    newDoc.set('permissions.users', [new mongoose.Types.ObjectId('000000000000000000000000')]);
    await newDoc.save();

    // find the doc
    const found = await findDoc({ model: colName, _id: newDoc._id, context });
    expect(found).toHaveProperty('_id', newDoc._id);

    // cleanup
    await newDoc.delete();
  });

  it(`should find a doc by property other than _id`, async () => {
    const Document = createModel(
      c.collection.name,
      { slug: { type: 'String' } },
      c.collection.withPermissions
    ) as Model<{
      slug: string;
    }>;
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    newDoc.set('slug', 'new-document');
    await newDoc.save();

    // find the doc
    const found = await findDoc({ model: colName, by: 'slug', _id: newDoc.slug, context, fullAccess: true });
    expect(found).toHaveProperty('slug', newDoc.slug);

    // cleanup
    await newDoc.delete();
  });

  it(`should find the newest doc when finding by a property that is the same`, async () => {
    const Document = createModel(
      c.collection.name,
      { slug: { type: 'String', default: 'new-document' }, letter: { type: 'String' } },
      c.collection.withPermissions
    ) as Model<{
      slug: string;
      letter: string;
    }>;
    const context = useApolloContext(c);

    const newDocA = new Document({ letter: 'a', 'timestamps.created_at': new Date(Date.now() - 1000) }); // subtract time to make it older than b
    await newDocA.save();

    const newDocB = new Document({ letter: 'b', 'timestamps.created_at': new Date() });
    await newDocB.save();

    const newDocC = new Document({ letter: 'c', 'timestamps.created_at': new Date(Date.now() - 2000) }); // subtract time to make it older than b
    await newDocC.save();

    // find the doc
    const found = await findDoc({ model: colName, by: 'slug', _id: newDocB.slug, context, fullAccess: true });
    expect(found).toHaveProperty('letter', 'b');

    // cleanup
    await newDocA.delete();
    await newDocB.delete();
    await newDocC.delete();
  });

  it(`should be an instance of the mongoose Document class when lean is false`, async () => {
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    newDoc.set('slug', 'new-document');
    await newDoc.save();

    // find the doc
    const found = await findDoc({ model: colName, _id: newDoc._id, context, fullAccess: true, lean: false });
    expect(found?.constructor.name).toEqual(Document.name);

    // cleanup
    await newDoc.delete();
  });
});
