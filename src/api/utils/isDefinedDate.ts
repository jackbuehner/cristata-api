import { isIsoDateString } from './isIsoDateString';

/**
 * Whether the input is an ISO 8601 date string
 * and is not `0001-01-01T01:00:00.000Z`.
 */
function isDefinedDate(toCheck: unknown): toCheck is string {
  return isIsoDateString(toCheck) && toCheck !== new Date('0001-01-01T01:00:00.000+00:00').toISOString();
}

export { isDefinedDate };
