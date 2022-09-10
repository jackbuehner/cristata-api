/**
 * Generate the type inheritance string for the typeDef.
 */
function getTypeInheritance(canPublish: boolean, withPermissions: boolean) {
  if (canPublish && withPermissions) return 'PublishableCollection, WithPermissions';
  else if (canPublish && !withPermissions) return 'PublishableCollection';
  else if (!canPublish && withPermissions) return 'Collection, WithPermissions';
  return 'Collection';
}

export { getTypeInheritance };
