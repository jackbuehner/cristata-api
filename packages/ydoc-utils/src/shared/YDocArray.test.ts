import { YDocArray } from './YDocArray';
import { YString } from './YString';
import * as Y from 'yjs';

describe(`shared >> YDocArray`, () => {
  const ydoc = new Y.Doc();
  let docArrayType: YDocArray<string, Record<string, unknown>[]>;

  it('should create a new instance', async () => {
    docArrayType = new YDocArray(ydoc);
    expect(docArrayType).toBeInstanceOf(YDocArray);
  });

  it('should set and get doc array contents', async () => {
    // set value
    docArrayType.set('DOC_ARRAY', [{ name: 'hello' }, { name: 'world' }]);

    // create doc array children shared types
    const uuids = (await docArrayType.get('DOC_ARRAY')).map(({ __uuid }) => __uuid as string);
    new YString(ydoc).set(`__docArray.‾‾DOC_ARRAY‾‾.${uuids[0]}.name`, 'hello');
    new YString(ydoc).set(`__docArray.‾‾DOC_ARRAY‾‾.${uuids[1]}.name`, 'world');

    // get value
    const value = await docArrayType.get('DOC_ARRAY');

    // verify value
    expect(value).toHaveLength(2);
    expect(value[0]).toHaveProperty('name', 'hello');
    expect(value[1]).toHaveProperty('name', 'world');
  });

  it('should return an empty array when provided an empty array', async () => {
    // set value
    docArrayType.set('DOC_ARRAY_EMPTY', []);

    // get value
    const value = await docArrayType.get('DOC_ARRAY_EMPTY');

    // verify value
    expect(value).toHaveLength(0);
  });

  describe('>> existence', () => {
    it('should return true when checking presence of an existing key-value pair', async () => {
      docArrayType.set('EXISTING', []);
      const value = docArrayType.has('EXISTING');
      expect(value).toBe(true);
    });

    it('should return false when checking presence of a missing key-value pair', async () => {
      const value = docArrayType.has('MISSING');
      expect(value).toBe(false);
    });
  });

  describe('>> removal', () => {
    it('should successfully remove a key-value pair', async () => {
      // set value
      docArrayType.set('TO_REMOVE', [{ name: 'hello' }, { name: 'world' }]);

      // create doc array children shared types
      const uuids = (await docArrayType.get('TO_REMOVE')).map(({ __uuid }) => __uuid as string);
      new YString(ydoc).set(`__docArray.‾‾TO_REMOVE‾‾.${uuids[0]}.name`, 'hello');
      new YString(ydoc).set(`__docArray.‾‾TO_REMOVE‾‾.${uuids[1]}.name`, 'world');

      // get value
      const value = await docArrayType.get('TO_REMOVE');

      // verify value
      expect(value).toHaveLength(2);
      expect(value[0]).toHaveProperty('name', 'hello');
      expect(value[1]).toHaveProperty('name', 'world');
      expect(docArrayType.has('TO_REMOVE')).toBe(true);

      // verify that doc array is gone
      docArrayType.delete('TO_REMOVE');
      expect(docArrayType.has('TO_REMOVE')).toBe(false);

      // verify that other types are gone
      expect(ydoc.share.has(`__docArray.‾‾TO_REMOVE‾‾.${uuids[0]}.name`)).toBe(false);
      expect(ydoc.share.has(`__docArray.‾‾TO_REMOVE‾‾.${uuids[1]}.name`)).toBe(false);
    });

    it('should do nothing on attempt to remove a missing key-value pair', async () => {
      expect(docArrayType.has('TO_REMOVE_MISSING')).toBe(false);

      docArrayType.delete('TO_REMOVE_MISSING');
      expect(docArrayType.has('TO_REMOVE_MISSING')).toBe(false);
    });
  });
});
