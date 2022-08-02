import { IncomingHttpHeaders } from 'http';
import Keygrip from 'keygrip';
import { parseCookies } from './parseCookies';

function checkSessionCookie(headers: IncomingHttpHeaders): Error | void {
  if (!headers.cookie) {
    return new Error('NO_COOKIE_IN_HEADER');
  }

  const parsedCookies = parseCookies(headers.cookie);
  const authCookie = parsedCookies.find((cookie) => cookie.name === '__Host-cristata-session');
  if (!authCookie) {
    return new Error('NO_SESSION_COOKIE');
  }

  // verify cookie integrity
  const keygrip = new Keygrip([process.env.COOKIE_SESSION_SECRET]);
  const { name, value, signature } = authCookie;
  const isUntampered = keygrip.verify(`${name}=${value}`, signature);
  if (!isUntampered) {
    // the cookie has been modified by the client
    return new Error(`SESSION_COOKIE_TAMPERED`);
  }

  return;
}

export { checkSessionCookie };
