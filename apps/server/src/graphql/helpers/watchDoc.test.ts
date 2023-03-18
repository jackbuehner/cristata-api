import { ApolloError, ForbiddenError } from 'apollo-server-core';
import { Model } from 'mongoose';
import { useApolloContext, useMongoose } from '../../../tests/hooks';
import { watchDoc } from './watchDoc';

describe(`api >> v3 >> helpers >> watchDoc`, () => {
  const { createModel, mongoose } = useMongoose();

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
          watch: { users: [0], teams: [0] },
          archive: { users: [0], teams: [0] },
          lock: { users: [0], teams: [0] },
          delete: { users: [0], teams: [0] },
        },
      },
    };
  });

  it('should add the current user to the list of watchers', async () => {
    // do not use standard permissions
    c.collection.withPermissions = false;

    // create the model and context
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    await newDoc.save();

    // watch the doc
    const found = await watchDoc({ model: colName, accessor: { value: newDoc._id }, context });
    expect(found).toHaveProperty('_id', newDoc._id);
    expect(found).toHaveProperty('people.watching', [context.profile?._id]);

    // cleanup
    await newDoc.deleteOne();
  });

  it('should remove the current user from the list of watchers', async () => {
    // do not use standard permissions
    c.collection.withPermissions = false;

    // create the model and context
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    await newDoc.save();
    const newDocM = await watchDoc({ model: colName, accessor: { value: newDoc._id }, context });
    expect(newDocM).toHaveProperty('people.watching', [context.profile?._id]);

    // watch the doc
    const found = await watchDoc({ model: colName, accessor: { value: newDoc._id }, watch: false, context });
    expect(found).toHaveProperty('_id', newDoc._id);
    expect(found).toHaveProperty('people.watching', []);

    // cleanup
    await newDoc.deleteOne();
  });

  it('should add a user to the list of watchers who is not the current user', async () => {
    // do not use standard permissions
    c.collection.withPermissions = false;

    // create the model and context
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    await newDoc.save();

    // watch the doc
    const found = await watchDoc({
      model: colName,
      accessor: { value: newDoc._id },
      watcher: new mongoose.Types.ObjectId('000000000000000000000099'),
      context,
    });
    expect(found).toHaveProperty('_id', newDoc._id);
    expect(found).toHaveProperty('people.watching', [new mongoose.Types.ObjectId('000000000000000000000099')]);

    // cleanup
    await newDoc.deleteOne();
  });

  it('should remove a user who is not the current user from the list of watchers', async () => {
    // do not use standard permissions
    c.collection.withPermissions = false;

    // create the model and context
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    await newDoc.save();
    const newDocM = await watchDoc({
      model: colName,
      accessor: { value: newDoc._id },
      watcher: new mongoose.Types.ObjectId('000000000000000000000099'),
      context,
    });
    expect(newDocM).toHaveProperty('people.watching', [
      new mongoose.Types.ObjectId('000000000000000000000099'),
    ]);

    // watch the doc
    const found = await watchDoc({
      model: colName,
      accessor: { value: newDoc._id },
      watch: false,
      watcher: new mongoose.Types.ObjectId('000000000000000000000099'),
      context,
    });
    expect(found).toHaveProperty('_id', newDoc._id);
    expect(found).toHaveProperty('people.watching', []);

    // cleanup
    await newDoc.deleteOne();
  });

  it('should watch a doc that uses an accessor key other than _id with accessor of type string', async () => {
    // do not use standard permissions
    c.collection.withPermissions = false;

    // create the model and context
    const Document = createModel(
      c.collection.name,
      { slug: { type: String } },
      c.collection.withPermissions
    ) as Model<{
      slug: string;
    }>;
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    newDoc.set('slug', 'new-document');
    expect(newDoc).toHaveProperty('slug', 'new-document');
    await newDoc.save();

    // watch the doc
    const found = (
      await watchDoc({
        model: colName,
        accessor: { key: 'slug', value: 'new-document' },
        context,
      })
    ).toObject();
    expect(found).toHaveProperty('_id', newDoc._id);
    expect(found).toHaveProperty('slug', 'new-document');
    expect(found).toHaveProperty('people.watching', [context.profile?._id]);

    // cleanup
    await newDoc.deleteOne();
  });

  it('should watch a doc with a accessor of type number', async () => {
    // do not use standard permissions
    c.collection.withPermissions = false;

    // create the model and context
    const Document = createModel(
      c.collection.name,
      { num: { type: 'Number' } },
      c.collection.withPermissions
    ) as Model<{
      num: number;
    }>;
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    newDoc.set('num', 2);
    expect(newDoc).toHaveProperty('num', 2);
    await newDoc.save();

    // watch the doc
    const found = (await watchDoc({ model: colName, accessor: { key: 'num', value: 2 }, context })).toObject();
    expect(found).toHaveProperty('_id', newDoc._id);
    expect(found).toHaveProperty('num', 2);
    expect(found).toHaveProperty('people.watching', [context.profile?._id]);

    // cleanup
    await newDoc.deleteOne();
  });

  it('should watch a doc with a accessor of type Date', async () => {
    // do not use standard permissions
    c.collection.withPermissions = false;

    // create the model and context
    const Document = createModel(
      c.collection.name,
      { date: { type: 'Date' } },
      c.collection.withPermissions
    ) as Model<{
      date: Date;
    }>;
    const context = useApolloContext(c);

    // create a placeholder Date
    const date = new Date();

    // create and save a doc to find
    const newDoc = new Document();
    newDoc.set('date', date);
    expect(newDoc).toHaveProperty('date', date);
    await newDoc.save();

    // watch the doc
    const found = (
      await watchDoc({ model: colName, accessor: { key: 'date', value: date }, context })
    ).toObject();
    expect(found).toHaveProperty('_id', newDoc._id);
    expect(found).toHaveProperty('date', date);
    expect(found).toHaveProperty('people.watching', [context.profile?._id]);

    // cleanup
    await newDoc.deleteOne();
  });

  it('should throw ForbiddenError when the user does not have permission to watch', async () => {
    // do not use standard permissions
    c.collection.actionAccess.watch = { users: [], teams: [] };

    // create the model and context
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    newDoc.set('permissions.users', [context.profile?._id]); // give current user access to the doc
    await newDoc.save();

    // watch the doc
    const promise = watchDoc({ model: colName, accessor: { value: newDoc._id }, context });
    const expectedError = new ForbiddenError('you cannot watch this document');
    await expect(promise).rejects.toThrow(expectedError);

    // cleanup
    await newDoc.deleteOne();
  });

  it('should throw DOCUMENT_NOT_FOUND error on attempt to watch a document that the user cannot access', async () => {
    // do not use standard permissions
    c.collection.actionAccess.watch = { users: [], teams: [] };

    // create the model and context
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    newDoc.set('permissions.users', []);
    expect(newDoc).toHaveProperty('permissions.users', []);
    await newDoc.save();

    // watch the doc
    const promise = watchDoc({ model: colName, accessor: { value: newDoc._id }, context });
    const expectedError = new ApolloError(
      'the document you are trying to watch does not exist or you do not have access',
      'DOCUMENT_NOT_FOUND'
    );
    await expect(promise).rejects.toThrow(expectedError);

    // cleanup
    await newDoc.deleteOne();
  });
});
