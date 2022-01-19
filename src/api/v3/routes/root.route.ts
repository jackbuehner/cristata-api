import { Router } from 'express';
import mongoose from 'mongoose';
import { IUser } from '../../../config/collections/users';
import { IDeserializedUser } from '../../../passport';
import https from 'https';

/**
 * Router for root endpoints for the v3 API.
 *
 */
const router = Router();

router.get('/user-photo/:user_id', async (req, res) => {
  try {
    // define model
    const User = mongoose.model<IUser>('User');

    // make authenticated user available
    const authUser = req.user as IDeserializedUser;

    // identify the user _id
    const user_id = req.params.user_id === 'me' ? authUser._id : req.params.user_id;

    // get the user
    const user = await User.findById(user_id);

    // pipe the request to the user photo url
    const externalReq = https.request(user.photo, (externalRes) => {
      externalRes.pipe(res);
    });
    externalReq.end();
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

export { router as rootRouter };
