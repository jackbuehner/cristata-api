import crypto from 'crypto';
import { GraphQLScalarType } from 'graphql';

const encryptedString = new GraphQLScalarType({
  name: 'EncryptedString',
  description: 'Encrypted string scalar type',
  serialize(value) {
    const decrypted = decrypt(value);
    return decrypted;
  },
  parseValue(value) {
    const encrypted = encrypt(value);
    return encrypted;
  },
});

const algorithm = 'aes-256-ctr';
const secretKey = process.env.ENCRYPTED_STRING_PASSCODE as string;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);

  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

  return iv.toString('hex') + '::' + encrypted.toString('hex');
}

function decrypt(hash: string): string {
  const [iv, content] = hash.split('::');

  const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(iv, 'hex'));
  const decrpyted = Buffer.concat([decipher.update(Buffer.from(content, 'hex')), decipher.final()]);

  return decrpyted.toString();
}

export { encryptedString };
