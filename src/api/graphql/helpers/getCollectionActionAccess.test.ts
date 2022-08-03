import { Model } from 'mongoose';
import { useApolloContext, useMongoose, useWebsocket } from '../../../../tests/hooks';
import { getCollectionActionAccess } from './getCollectionActionAccess';

describe(`api >> v3 >> helpers >> getCollectionActionAccess`, () => {
  const { createModel } = useMongoose();
  useWebsocket();

  const c: Parameters<typeof useApolloContext>[0] = {
    isAuthenticated: true,
    collection: {
      name: 'Foo',
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
  const context = useApolloContext(c);

  const Document = createModel(
    c.collection.name,
    { slug: { type: 'String' } },
    c.collection.withPermissions
  ) as Model<{
    slug: string;
  }>;

  const doc1 = new Document({ slug: 'one' });
  const doc2 = new Document({ slug: 'two' });
  beforeAll(async () => {
    await doc1.save();
    await doc2.save();
  });

  it('should return a complete action access object', async () => {
    const actionAccess = await getCollectionActionAccess({ model: c.collection.name, context });
    expect(actionAccess).toHaveProperty('get');
    expect(actionAccess).toHaveProperty('create');
    expect(actionAccess).toHaveProperty('modify');
    expect(actionAccess).toHaveProperty('hide');
    expect(actionAccess).toHaveProperty('lock');
    expect(actionAccess).toHaveProperty('watch');
    expect(actionAccess).toHaveProperty('publish');
    expect(actionAccess).toHaveProperty('archive');
    expect(actionAccess).toHaveProperty('deactivate');
    expect(actionAccess).toHaveProperty('delete');
    expect(typeof actionAccess.get === 'boolean').toBeTruthy();
    expect(typeof actionAccess.create === 'boolean').toBeTruthy();
    expect(typeof actionAccess.modify === 'boolean').toBeTruthy();
    expect(typeof actionAccess.hide === 'boolean').toBeTruthy();
    expect(typeof actionAccess.lock === 'boolean').toBeTruthy();
    expect(typeof actionAccess.watch === 'boolean').toBeTruthy();
    expect(typeof actionAccess.publish === 'boolean').toBeTruthy();
    expect(typeof actionAccess.archive === 'boolean').toBeTruthy();
    expect(typeof actionAccess.deactivate === 'boolean' || actionAccess.deactivate === null).toBeTruthy();
    expect(typeof actionAccess.delete === 'boolean').toBeTruthy();
  });

  it('should return action access for a collection document (by _id)', async () => {
    const actionAccess = await getCollectionActionAccess({
      model: c.collection.name,
      args: { _id: doc2._id },
      context,
    });
    expect(actionAccess).toHaveProperty('get');
  });

  it('should return action access for a collection document (by string accessor)', async () => {
    const actionAccess = await getCollectionActionAccess({
      model: c.collection.name,
      args: { _id: doc1.slug, by: 'slug' },
      context,
    });
    expect(actionAccess).toHaveProperty('get');
  });
});
