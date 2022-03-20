import { splitOnce } from './splitOnce';

type ParsedCookie = {
  name: string;
  value: string | null;
  signature?: string;
};

/**
 * Parses a cookie heaader string and returns an array of objects
 * with cookie name, value, and (in applicable) signature.
 *
 * This is intended to be used when cookie info is required for auth.
 */
function parseCookies(cookies: string): ParsedCookie[] {
  const parsed: ParsedCookie[] = [];
  cookies.split(';').forEach((cookie) => {
    // destructure name and value from cookie string
    const [name, value] = splitOnce(cookie, '=');

    // if cookie is a signature cookie, include it with the actual cookie
    const isSig = name.includes('.sig');
    if (isSig) {
      // find main cookie
      const mainIndex = parsed.findIndex((cookie) => cookie.name === name.replace('.sig', ''));
      const mainExists = mainIndex >= 0;

      // store in cookies array
      if (mainExists) {
        parsed[mainIndex] = {
          ...parsed[mainIndex],
          signature: value,
        };
      } else {
        parsed.push({
          name,
          value: null,
          signature: value,
        });
      }
    }

    // otherwise, insert the main cookie
    else {
      // determine if main cookie already exists (due to signature being stored first)
      const mainIndex = parsed.findIndex((cookie) => cookie.name === name);
      const mainExists = mainIndex >= 0;

      // store in cookies array
      if (mainExists) {
        parsed[mainIndex] = {
          ...parsed[mainIndex],
          value,
        };
      } else {
        parsed.push({ name, value });
      }
    }
  });
  return parsed;
}

export { parseCookies };
