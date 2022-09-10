import { ApolloError, ForbiddenError } from 'apollo-server-core';
import { Model } from 'mongoose';
import { useApolloContext, useMongoose } from '../../../tests/hooks';
import { archiveDoc } from './archiveDoc';

describe(`api >> v3 >> helpers >> archiveDoc`, () => {
  const { createModel } = useMongoose();

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

  it('should archive a doc that is not currently archived', async () => {
    // do not use standard permissions
    c.collection.withPermissions = false;

    // create the model and context
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    await newDoc.save();
    expect(newDoc).toHaveProperty('archived', false);

    // archive the doc
    const found = await archiveDoc({ model: colName, accessor: { value: newDoc._id }, context });
    expect(found).toHaveProperty('_id', newDoc._id);
    expect(found).toHaveProperty('archived', true);

    // cleanup
    await newDoc.delete();
  });

  it('should archive a doc that is currently archived', async () => {
    // do not use standard permissions
    c.collection.withPermissions = false;

    // create the model and context
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document({ archived: true });
    await newDoc.save();
    expect(newDoc).toHaveProperty('archived', true);

    // archive the doc
    const found = await archiveDoc({ model: colName, accessor: { value: newDoc._id }, context });
    expect(found).toHaveProperty('_id', newDoc._id);
    expect(found).toHaveProperty('archived', true);

    // cleanup
    await newDoc.delete();
  });

  it('should unarchive a doc that is currently archived', async () => {
    // do not use standard permissions
    c.collection.withPermissions = false;

    // create the model and context
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document({ archived: true });
    await newDoc.save();
    expect(newDoc).toHaveProperty('archived', true);

    // unarchive the doc
    const found = await archiveDoc({
      model: colName,
      accessor: { value: newDoc._id },
      archive: false,
      context,
    });
    expect(found).toHaveProperty('_id', newDoc._id);
    expect(found).toHaveProperty('archived', false);

    // cleanup
    await newDoc.delete();
  });

  it('should unarchive a doc that is not currently archived', async () => {
    // do not use standard permissions
    c.collection.withPermissions = false;

    // create the model and context
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    await newDoc.save();
    expect(newDoc).toHaveProperty('archived', false);

    // unarchive the doc
    const found = await archiveDoc({
      model: colName,
      accessor: { value: newDoc._id },
      archive: false,
      context,
    });
    expect(found).toHaveProperty('_id', newDoc._id);
    expect(found).toHaveProperty('archived', false);

    // cleanup
    await newDoc.delete();
  });

  it('should archive a doc that uses an accessor key other than _id with accessor of type string', async () => {
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
    expect(newDoc).toHaveProperty('archived', false);
    await newDoc.save();

    // archive the doc
    const found = (
      await archiveDoc({
        model: colName,
        accessor: { key: 'slug', value: 'new-document' },
        context,
      })
    ).toObject();
    expect(found).toHaveProperty('_id', newDoc._id);
    expect(found).toHaveProperty('slug', 'new-document');
    expect(found).toHaveProperty('archived', true);

    // cleanup
    await newDoc.delete();
  });

  it('should archive a doc with a accessor of type number', async () => {
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
    expect(newDoc).toHaveProperty('archived', false);
    await newDoc.save();

    // archive the doc
    const found = (
      await archiveDoc({ model: colName, accessor: { key: 'num', value: 2 }, context })
    ).toObject();
    expect(found).toHaveProperty('_id', newDoc._id);
    expect(found).toHaveProperty('num', 2);
    expect(found).toHaveProperty('archived', true);

    // cleanup
    await newDoc.delete();
  });

  it('should archive a doc with a accessor of type Date', async () => {
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
    expect(newDoc).toHaveProperty('archived', false);
    await newDoc.save();

    // archive the doc
    const found = (
      await archiveDoc({ model: colName, accessor: { key: 'date', value: date }, context })
    ).toObject();
    expect(found).toHaveProperty('_id', newDoc._id);
    expect(found).toHaveProperty('date', date);
    expect(found).toHaveProperty('archived', true);

    // cleanup
    await newDoc.delete();
  });

  it('should throw ForbiddenError on attempt to archive a doc that is currently published', async () => {
    // do not use standard permissions
    c.collection.withPermissions = false;

    // make the collection a publishable collection
    c.collection.canPublish = true;

    // create the model and context
    const Document = createModel(
      c.collection.name,
      undefined,
      c.collection.withPermissions,
      c.collection.canPublish
    );
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    newDoc.set('timestamps.published_at', new Date('2020-01-01').toISOString());
    expect(newDoc).toHaveProperty('archived', false);
    await newDoc.save();

    // archive the doc
    const promise = archiveDoc({ model: colName, accessor: { value: newDoc._id }, context });
    const expectedError = new ForbiddenError('you cannot archive this document when it is published');
    await expect(promise).rejects.toThrow(expectedError);

    // cleanup
    await newDoc.delete();
  });

  it('should throw ForbiddenError when the user does not have permission to archive', async () => {
    // do not use standard permissions
    c.collection.actionAccess.archive = { users: [], teams: [] };

    // create the model and context
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    if (context.profile) newDoc.set('permissions.users', [context.profile._id]); // give current user access to the doc
    expect(newDoc).toHaveProperty('archived', false);
    await newDoc.save();

    // archive the doc
    const promise = archiveDoc({ model: colName, accessor: { value: newDoc._id }, context });
    const expectedError = new ForbiddenError('you cannot archive this document');
    await expect(promise).rejects.toThrow(expectedError);

    // cleanup
    await newDoc.delete();
  });

  it('should throw ForbiddenError when no archive permissions are set', async () => {
    // do not use standard permissions
    //@ts-expect-error disable archive permissions
    c.collection.actionAccess.archive = undefined;

    // create the model and context
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    if (context.profile) newDoc.set('permissions.users', [context.profile._id]); // give current user access to the doc
    expect(newDoc).toHaveProperty('archived', false);
    await newDoc.save();

    // archive the doc
    const promise = archiveDoc({ model: colName, accessor: { value: newDoc._id }, context });
    const expectedError = new ForbiddenError('you cannot archive this document');
    await expect(promise).rejects.toThrow(expectedError);

    // cleanup
    await newDoc.delete();
  });

  it('should throw DOCUMENT_NOT_FOUND error on attempt to archive a document that the user cannot access', async () => {
    // do not use standard permissions
    c.collection.actionAccess.archive = { users: [], teams: [] };

    // create the model and context
    const Document = createModel(c.collection.name, undefined, c.collection.withPermissions);
    const context = useApolloContext(c);

    // create and save a doc to find
    const newDoc = new Document();
    newDoc.set('permissions.users', []);
    expect(newDoc).toHaveProperty('permissions.users', []);
    await newDoc.save();

    // archive the doc
    const promise = archiveDoc({ model: colName, accessor: { value: newDoc._id }, context });
    const expectedError = new ApolloError(
      'the document you are trying to archive does not exist or you do not have access',
      'DOCUMENT_NOT_FOUND'
    );
    await expect(promise).rejects.toThrow(expectedError);

    // cleanup
    await newDoc.delete();
  });
});
