import { Router } from 'express';
import https from 'https';
import { Octokit } from 'octokit';

/**
 * This router contains the proxy route.
 *
 * This router expects to be found at `/proxy`. It removes "/proxy" from the URL path, and proxies the rest of the URL.
 *
 * This proxy only works on allowed origins. See `allowedOrigins` in `/middleware/cors`.
 */
function factory(): Router {
  const router = Router();

  const octokit = new Octokit({
    auth: process.env.GH_RELEASE_TOKEN,
  });

  router.get('/app/:target/:arch/:current_version', async (req, res) => {
    const t = await octokit.request('GET /repos/{owner}/{repo}/releases/latest', {
      owner: 'jackbuehner',
      repo: 'cristata-app',
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    const releaseVersion = t.data.tag_name.replace('app-v', '');

    // if the client app version is the same as the latest published version, we must send 204 status
    if (releaseVersion === req.params.current_version) {
      res.status(204).end();
      return;
    }

    const releaseAsset = t.data.assets.find((a) => a.name === `Cristata_${releaseVersion}_x64_en-US.msi.zip`);
    const signatureAsset = t.data.assets.find(
      (a) => a.name === `Cristata_${releaseVersion}_x64_en-US.msi.zip.sig`
    );

    let signature = '';
    if (signatureAsset) {
      const a = await octokit.request('GET /repos/{owner}/{repo}/releases/assets/{asset_id}', {
        owner: 'jackbuehner',
        repo: 'cristata-app',
        asset_id: signatureAsset.id,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
          Accept: 'application/octet-stream',
        },
      });

      if (a && a.data && typeof a.data === 'string') {
        signature = a.data;
      }
    }

    res.status(200).json({
      url: `https://server.cristata.app/releases/app/asset/${releaseAsset?.id}`,
      version: releaseVersion,
      notes: t.data.body,
      pub_date: t.data.published_at,
      signature: signature,
    });
  });

  router.get(`/app/asset/:asset_id`, async (req, res) => {
    const a = await octokit.request('GET /repos/{owner}/{repo}/releases/assets/{asset_id}', {
      owner: 'jackbuehner',
      repo: 'cristata-app',
      asset_id: parseInt(req.params['asset_id']),
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
        Accept: 'application/octet-stream',
      },
    });

    // use the correct headers (provided by GitHub)
    Object.entries(a.headers).forEach(([key, value]) => {
      if (key && value) res.setHeader(key, value);
    });

    // pipe the request to this url
    if (a.url) {
      const externalReq = https.request(a.url, (externalRes) => {
        externalRes.pipe(res);
      });
      externalReq.end();
    } else {
      res.status(404).end();
    }
  });

  return router;
}

export { factory as releaseRouterFactory };
