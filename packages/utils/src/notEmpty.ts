/**
 * Returns whether a value is not empty (not null and not undefined)
 */
function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export { notEmpty };
