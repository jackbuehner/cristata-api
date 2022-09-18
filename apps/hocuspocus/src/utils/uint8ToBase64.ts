export const uint8ToBase64 = (arr: Uint8Array): string => Buffer.from(arr).toString('base64');
