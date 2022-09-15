import * as Y from 'yjs';
import { YFloat } from './YFloat';

describe(`shared >> YFloat`, () => {
  const ydoc = new Y.Doc();
  let floatType: YFloat<string, number | undefined | null>;

  it('should create a new instance', async () => {
    floatType = new YFloat(ydoc);
    expect(floatType).toBeInstanceOf(YFloat);
  });

  it('should set and get a float', async () => {
    floatType.set('FLOAT', 1234.56);
    const value = floatType.get('FLOAT', false);
    expect(value).toBe(1234.56);
  });

  it('should set and get an int', async () => {
    floatType.set('FLOAT', 1234);
    const value = floatType.get('FLOAT', false);
    expect(value).toBe(1234);
  });

  it('should set an undefined number and get `NaN`', async () => {
    floatType.set('UNDEFINED_NUMBER', undefined);
    const value = floatType.get('UNDEFINED_NUMBER', false);
    expect(value).toBe(NaN);
  });

  it('should set a null number and get `NaN`', async () => {
    floatType.set('NULL_NUMBER', null);
    const value = floatType.get('NULL_NUMBER', false);
    expect(value).toBe(NaN);
  });

  it('should set and get an array with null and undefined values removed', async () => {
    floatType.set('ARRAY', [1234, 1234, null, undefined], [{ value: 1234, label: '1234' }]);
    const value = floatType.get('ARRAY', true);
    expect(value).toHaveLength(2);
    expect(value[0]).toHaveProperty('value', 1234);
    expect(value[1]).toHaveProperty('value', 1234);
  });

  it('should return `NaN` on attempt to get a missing key-value pair', async () => {
    const value = floatType.get('MISSING', false);
    expect(value).toBe(NaN);
  });

  it('should return true when checking presence of an existing key-value pair', async () => {
    floatType.set('EXISTING', 1234.56);
    const value = floatType.has('EXISTING');
    expect(value).toBe(true);
  });

  it('should return false when checking presence of a missing key-value pair', async () => {
    const value = floatType.has('MISSING_NUMBER');
    expect(value).toBe(false);
  });

  it('should successfully remove a key-value pair', async () => {
    floatType.set('TO_REMOVE', 1234.56);
    expect(floatType.has('TO_REMOVE')).toBe(true);

    floatType.delete('TO_REMOVE');
    expect(floatType.has('TO_REMOVE')).toBe(false);
  });

  it('should do nothing on attempt to remove a missing key-value pair', async () => {
    expect(floatType.has('TO_REMOVE_MISSING')).toBe(false);

    floatType.delete('TO_REMOVE_MISSING');
    expect(floatType.has('TO_REMOVE_MISSING')).toBe(false);
  });
});
