export const base64ToUint8 = (str: string): Uint8Array => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
