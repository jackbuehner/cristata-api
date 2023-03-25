import { Request } from 'express';

function isInternalUse(req: Request) {
  const originHostname = (() => {
    try {
      if (req.headers.origin) return new URL(req.headers.origin).hostname;
      return 'SERVER_SIDE_REQUEST';
    } catch {
      return 'SERVER_SIDE_REQUEST';
    }
  })();
  const internalDomain = 'cristata.app';
  const isInternal = originHostname.indexOf(internalDomain) === originHostname.length - internalDomain.length;
  return isInternal || process.env.NODE_ENV === 'development';
}

export { isInternalUse };
