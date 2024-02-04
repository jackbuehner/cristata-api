import ColorHash from 'color-hash';
import { Router } from 'express';
import https from 'https';
import mime from 'mime';
import { TenantDB } from '../../mongodb/TenantDB';
import { IFile } from '../../mongodb/files';
import { IPhoto } from '../../mongodb/photos';
import { IUser } from '../../mongodb/users';
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
        colorHash.hex(id),
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

// always redirect troop-370 file urls since they no longer use Cristata
// but they want the old filestore urls to still work
router.get('/filestore/troop-370/:_id', (req, res) => {
  res.redirect(301, `https://troop370atlanta.org/cristata-filestore/${req.params._id}`)
})

router.get('/filestore/:tenant/:_id', async (req, res) => {
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
    if (foundFile.require_auth === true && !req.user) {
      res.status(401).end();
      return;
    }

    // use the correct mime type and name
    const fileName =
      (foundFile.name.split('.').slice(0, -1) || 'file') + '.' + mime.extension(foundFile.file_type);
    res.setHeader('Content-Type', `${foundFile.file_type}; charset=UTF-8`);
    res.setHeader('Content-Disposition', `inline; filename="${fileName.replace(/[^a-zA-Z-._\d\s:]/g, '_')}"`);

    // allow usage on non-Cristata websites
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

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

router.get('/photo/:tenant/:_id', async (req, res) => {
  try {
    // connect to database
    const tenantDB = new TenantDB(req.params.tenant);
    await tenantDB.connect();
    const Photo = await tenantDB.model<IPhoto>('Photo');

    // get the photo, and end the request if it cannot be found
    const foundPhoto = await Photo?.findById(req.params._id);
    if (!foundPhoto) {
      res.status(404).end();
      return;
    }

    // if the photo requires Cristata authentication, ensure authenticated
    if (foundPhoto.require_auth === true && !req.user) {
      res.status(401).end();
      return;
    }

    // use the correct mime type and name
    const fileName =
      (foundPhoto.name.split('.').slice(0, -1) || 'photo') + '.' + mime.extension(foundPhoto.file_type);
    res.setHeader('Content-Type', `${foundPhoto.file_type}; charset=UTF-8`);
    res.setHeader('Content-Disposition', `inline; filename="${fileName.replace(/[^a-zA-Z-._\d\s:]/g, '_')}"`);

    // cache for a year -- photos are immutable
    res.setHeader('Cache-Control', 'private, max-age=31536000');

    // determine the bucket for this tenant
    const bucketName =
      req.params.tenant === 'paladin-news'
        ? 'paladin-photo-library'
        : `app.cristata.${req.params.tenant}.photos`;

    // construct the correct URL for this photo
    // using transformations (if available and allowed)
    // and fall back to the original photo location
    let s3href: string;
    const searchParams = req.query as unknown as URLSearchParams;
    if (searchParams.has('tr')) {
      const transformations = (searchParams.get('tr') || '').split(',');
      const width = transformations.find((tr) => tr.indexOf('w-') === 0)?.replace('w-', '');
      const height = transformations.find((tr) => tr.indexOf('h-') === 0)?.replace('h-', '');
      const resizeFit = transformations.find((tr) => tr.indexOf('fit-') === 0)?.replace('fit-', '');

      const cloudFrontLocation = 'https://dsm94u2p4guhh.cloudfront.net';

      const imageParams = {
        bucket: bucketName,
        key: foundPhoto.uuid,
        edits: {
          resize: {
            width,
            height,
            fit: resizeFit,
          },
        },
      };

      s3href = `${cloudFrontLocation}/${btoa(JSON.stringify(imageParams))}`;

      // allow usage only on Cristata websites
      res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    } else {
      s3href = `https://s3.us-east-1.amazonaws.com/${bucketName}/${foundPhoto.uuid}`;

      // allow usage on non-Cristata websites
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }

    // pipe the request to this photo
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
