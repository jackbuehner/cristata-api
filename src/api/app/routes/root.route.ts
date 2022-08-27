import { Router } from 'express';
import { IUser } from '../../mongodb/users';
import { IDeserializedUser } from '../passport';
import https from 'https';
import { TenantDB } from '../../mongodb/TenantDB';

/**
 * Router for root endpoints for the v3 API.
 *
 */
const router = Router();

router.get('/user-photo/:user_id', async (req, res) => {
  try {
    // connect to database
    const tenantDB = new TenantDB((req.user as IDeserializedUser).tenant);
    await tenantDB.connect();
    const User = await tenantDB.model<IUser>('User');

    // make authenticated user available
    const authUser = req.user as IDeserializedUser;

    // identify the user _id
    const user_id = req.params.user_id === 'me' ? authUser._id : req.params.user_id;

    // get the user
    const user = await User?.findById(user_id);

    // tell clients to cache profile photos for 5 minutes
    res.set('Cache-control', 'public, max-age=300');

    // pipe the request to the user photo url
    if (user?.photo) {
      const externalReq = https.request(user.photo, (externalRes) => {
        externalRes.pipe(res);
      });
      externalReq.end();
    } else {
      res.status(404).end();
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

export { router as rootRouter };
