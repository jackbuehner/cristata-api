import ColorHash from 'color-hash';
import { Router } from 'express';
import https from 'https';
import mime from 'mime';
import { IFile } from '../../mongodb/files';
import { TenantDB } from '../../mongodb/TenantDB';
import { IUser } from '../../mongodb/users';
import { requireAuth } from '../middleware/requireAuth';
import { IDeserializedUser } from '../passport';

/**
 * Router for root endpoints for the v3 API.
 *
 */
const router = Router();

router.get('/v3/:tenant/user-photo/:user_id', async (req, res) => {
  try {
    // connect to database
    const tenantDB = new TenantDB(req.params.tenant);
    await tenantDB.connect();
    const User = await tenantDB.model<IUser>('User');

    // make authenticated user available
    const authUser = req.user as IDeserializedUser;

    // identify the user _id
    const user_id = req.params.user_id === 'me' ? authUser._id : req.params.user_id;

    // get the user
    const user = await User?.findById(user_id, { _id: 1, photo: 1 });

    // set the header for the phooto type
    if (user?.photo) {
      const type = mime.lookup(user.photo);
      const charset = mime.charsets.lookup(user.photo, 'UTF-8');
      res.setHeader('Content-Type', type + (charset ? '; charset=' + charset : ''));
    } else {
      res.setHeader('Content-Type', 'image/svg+xml');
    }

    // tell clients to cache profile photos for 5 minutes
    res.set('Cache-control', 'public, max-age=300');

    // pipe the request to the user photo url
    if (user?.photo) {
      const externalReq = https.request(user.photo, (externalRes) => {
        externalRes.pipe(res);
      });
      externalReq.end();
    } else if (user) {
      const size = (req.query as unknown as URLSearchParams).get('size') || '120';

      const avatar = new URL(`https://source.boringavatars.com/beam/${size}/62fd3aef937c1ea557370d33`);
      avatar.searchParams.set('square', '');

      // @ts-expect-error 'bkdr' is a vlid hash config value
      const colorHash = new ColorHash({ saturation: 0.6, lightness: 0.7, hash: 'bkdr' }); // note that this config is different than the one that picks the user accent color

      const id = user._id.toHexString();
      const colors = [
        colorHash.hex(user._id),
        colorHash.hex(id.substr(4, id.length / 2)),
        colorHash.hex(id.substr(id.length / 2, id.length)),
        colorHash.hex(id.split('').reverse().join('')),
      ];
      avatar.searchParams.set('colors', colors.toString().replace(/#/g, ''));

      const externalReq = https.request(avatar.toString(), (externalRes) => {
        externalRes.pipe(res);
      });
      externalReq.end();
    } else {
      res.status(404).end();
    }
  } catch (error) {
    console.error(error);
    res.status(404).end();
  }
});

router.get('/filestore/:tenant/:_id', async (req, res, next) => {
  try {
    // connect to database
    const tenantDB = new TenantDB(req.params.tenant);
    await tenantDB.connect();
    const File = await tenantDB.model<IFile>('File');

    // get the file, and end the request if it cannot be found
    const foundFile = await File?.findById(req.params._id);
    if (!foundFile) {
      res.status(404).end();
      return;
    }

    // if the file requires Cristata authentication, ensure authenticated
    if (foundFile.require_auth === true) {
      requireAuth(req, res, next);
    }

    // use the correct mime type and name
    res.setHeader('Content-Type', `${foundFile.file_type}; charset=UTF-8`);
    res.setHeader('Content-Disposition', `inline; filename="${foundFile.name}"`);

    // pipe the request to this url
    const s3href = `https://s3.us-east-1.amazonaws.com/app.cristata.${req.params.tenant}.files/${foundFile.uuid}`;
    const externalReq = https.request(s3href, (externalRes) => {
      externalRes.pipe(res);
    });
    externalReq.end();
  } catch (error) {
    console.error(error);
    res.status(500).end();
  }
});

export { router as rootRouter };
