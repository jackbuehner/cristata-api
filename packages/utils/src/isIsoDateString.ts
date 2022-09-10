/**
 * Whether the input is an ISO 8601 date string.
 */
function isIsoDateString(toCheck: unknown): toCheck is string {
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
  return typeof toCheck === 'string' && iso8601Regex.test(toCheck);
}

export { isIsoDateString };
