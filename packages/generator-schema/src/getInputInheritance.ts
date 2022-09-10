/**
 * Generate the input inheritance string for the typeDef.
 */
function getInputInheritance(canPublish: boolean, withPermissions: boolean) {
  if (withPermissions) return 'WithPermissionsInput';
  return undefined;
}

export { getInputInheritance };
