/* eslint-disable @typescript-eslint/no-explicit-any */
import { useApolloContext, useMongoose } from '../../../tests/hooks';
import { getUsers } from './getUsers';
import mongoose from 'mongoose';

describe(`api >> v3 >> helpers >> getUsers`, () => {
  const { createModel } = useMongoose();

  const c: Parameters<typeof useApolloContext>[0] = {
    isAuthenticated: true,
    collection: {
      name: 'User',
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

  let user1: any;
  let user2: any;

  beforeAll(async () => {
    const User = await createModel(c.collection.name);

    user1 = new User({ _id: '000000000000000000000001' });
    await user1.save();
    user2 = new User({ _id: '000000000000000000000002' });
    await user2.save();
  });

  it('should get a user object when a single ObjectId is provided', async () => {
    const user = await getUsers(user1._id, context);
    expect(user).toHaveProperty('_id', user1._id);
  });

  it('should get an array of different user objects when multiple different ObjectIds are provided', async () => {
    const user = await getUsers([user1._id, user2._id], context);
    expect(user[0]).toHaveProperty('_id', user1._id);
    expect(user[1]).toHaveProperty('_id', user2._id);
  });

  it('should get an array of the same user objects when the same ObjectIds are provided', async () => {
    const user = await getUsers([user1._id, user1._id], context);
    expect(user[0]).toHaveProperty('_id', user1._id);
    expect(user[1]).toHaveProperty('_id', user1._id);
  });
});
