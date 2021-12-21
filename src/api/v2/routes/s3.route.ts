import { Request, Response, Router } from 'express';
import aws from 'aws-sdk';

/**
 * Router for AWS s3 endpoints.
 *
 */
const router = Router();

router.get('/sign-s3', (req: Request, res: Response) => {
  const s3 = new aws.S3();
  const fileName = (req.query as unknown as URLSearchParams).get('file-name');
  const fileType = (req.query as unknown as URLSearchParams).get('file-type');
  const s3Bucket = (req.query as unknown as URLSearchParams).get('s3-bucket');

  if (!fileName) return res.status(400).json('Missing query "file-name"');
  if (!fileType) return res.status(400).json('Missing query "file-type"');
  if (!s3Bucket) return res.status(400).json('Missing query "s3-bucket"');

  const s3Params = {
    Bucket: s3Bucket,
    Key: fileName,
    Expires: 300, // 5 minutes for upload (some photos are big)
    ContentType: fileType,
    ACL: 'public-read',
  };

  s3.getSignedUrl('putObject', s3Params, (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).end();
    }
    const returnData = {
      signedRequest: data,
      url: `https://${s3Bucket}.s3.amazonaws.com/${fileName}`,
    };
    res.json(returnData);
  });
});

export { router as s3Router };
