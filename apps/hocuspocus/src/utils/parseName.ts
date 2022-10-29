export function parseName(documentName: string): ParseNameReturn {
  const [tenant, collectionName, itemId, ...rest] = documentName.split('.') as [
    string,
    string,
    string,
    string | undefined
  ];

  const version = rest.join('.');

  if (version === 'current') {
    return { tenant, collectionName, itemId, version: undefined };
  }

  if (version) {
    return { tenant, collectionName, itemId, version: new Date(version) };
  }

  return { tenant, collectionName, itemId, version: undefined };
}

interface ParseNameReturn {
  tenant: string;
  collectionName: string;
  itemId: string;
  version: Date | undefined;
}
