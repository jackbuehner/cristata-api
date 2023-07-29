export function parseName(documentName: string): ParseNameReturn {
  const [tenant, collectionName, itemId, ...rest] = documentName.split('.') as [
    string,
    string,
    string,
    string | undefined
  ];

  const version = rest.join('.');
  const parsedItemId = itemId.replace(/__‾‾/g, '.');

  if (version === 'current') {
    return { tenant, collectionName, itemId: parsedItemId, version: undefined };
  }

  if (version) {
    return { tenant, collectionName, itemId: parsedItemId, version: new Date(version) };
  }

  return { tenant, collectionName, itemId: parsedItemId, version: undefined };
}

interface ParseNameReturn {
  tenant: string;
  collectionName: string;
  itemId: string;
  version: Date | undefined;
}
