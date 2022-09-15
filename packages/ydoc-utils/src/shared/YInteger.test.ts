import * as Y from 'yjs';
import { YInteger } from './YInteger';

describe(`shared >> YInteger`, () => {
  const ydoc = new Y.Doc();
  let intType: YInteger<string, number | undefined | null>;

  it('should create a new instance', async () => {
    intType = new YInteger(ydoc);
    expect(intType).toBeInstanceOf(YInteger);
  });

  it('should set and get a float with decimal places removed', async () => {
    intType.set('FLOAT', 1234.56);
    const value = intType.get('FLOAT', false);
    expect(value).toBe(1234);
  });

  it('should set and get an int', async () => {
    intType.set('FLOAT', 1234);
    const value = intType.get('FLOAT', false);
    expect(value).toBe(1234);
  });

  it('should set an undefined number and get `NaN`', async () => {
    intType.set('UNDEFINED_NUMBER', undefined);
    const value = intType.get('UNDEFINED_NUMBER', false);
    expect(value).toBe(NaN);
  });

  it('should set a null number and get `NaN`', async () => {
    intType.set('NULL_NUMBER', null);
    const value = intType.get('NULL_NUMBER', false);
    expect(value).toBe(NaN);
  });

  it('should set and get an array with null and undefined values removed', async () => {
    intType.set('ARRAY', [1234, 1234, null, undefined], [{ value: 1234, label: '1234' }]);
    const value = intType.get('ARRAY', true);
    expect(value).toHaveLength(2);
    expect(value[0]).toHaveProperty('value', 1234);
    expect(value[1]).toHaveProperty('value', 1234);
  });

  it('should return `NaN` on attempt to get a missing key-value pair', async () => {
    const value = intType.get('MISSING', false);
    expect(value).toBe(NaN);
  });

  it('should return true when checking presence of an existing key-value pair', async () => {
    intType.set('EXISTING', 1234);
    const value = intType.has('EXISTING');
    expect(value).toBe(true);
  });

  it('should return false when checking presence of a missing key-value pair', async () => {
    const value = intType.has('MISSING_NUMBER');
    expect(value).toBe(false);
  });

  it('should successfully remove a key-value pair', async () => {
    intType.set('TO_REMOVE', 1234);
    expect(intType.has('TO_REMOVE')).toBe(true);

    intType.delete('TO_REMOVE');
    expect(intType.has('TO_REMOVE')).toBe(false);
  });

  it('should do nothing on attempt to remove a missing key-value pair', async () => {
    expect(intType.has('TO_REMOVE_MISSING')).toBe(false);

    intType.delete('TO_REMOVE_MISSING');
    expect(intType.has('TO_REMOVE_MISSING')).toBe(false);
  });
});
