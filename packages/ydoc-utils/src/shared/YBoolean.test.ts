import { YBoolean } from './YBoolean';
import * as Y from 'yjs';

describe(`shared >> YBoolean`, () => {
  const ydoc = new Y.Doc();
  let booleanType: YBoolean<string, boolean | undefined | null>;

  it('should create a new instance', async () => {
    booleanType = new YBoolean(ydoc);
    expect(booleanType).toBeInstanceOf(YBoolean);
  });

  it('should set and get a false value', async () => {
    booleanType.set('FALSE', false);
    const value = booleanType.get('FALSE');
    expect(value).toBe(false);
  });

  it('should set and get a true value', async () => {
    booleanType.set('TRUE', true);
    const value = booleanType.get('TRUE');
    expect(value).toBe(true);
  });

  it('should set and get an undefined value', async () => {
    booleanType.set('UNDEFINED', undefined);
    const value = booleanType.get('UNDEFINED');
    expect(value).toBe(undefined);
  });

  it('should set and get an null value', async () => {
    booleanType.set('NULL', null);
    const value = booleanType.get('NULL');
    expect(value).toBe(null);
  });

  it('should return undefined for a missing key-value pair', async () => {
    const value = booleanType.get('MISSING');
    expect(value).toBe(undefined);
  });

  it('should return true when checking presence of an existing key-value pair', async () => {
    booleanType.set('EXISTING', true);
    const value = booleanType.has('EXISTING');
    expect(value).toBe(true);
  });

  it('should return false when checking presence of a missing key-value pair', async () => {
    const value = booleanType.has('MISSING');
    expect(value).toBe(false);
  });

  it('should successfully remove a key-value pair', async () => {
    booleanType.set('TO_REMOVE', true);
    expect(booleanType.has('TO_REMOVE')).toBe(true);

    booleanType.delete('TO_REMOVE');
    expect(booleanType.has('TO_REMOVE')).toBe(false);
  });

  it('should do nothing on attempt to remove a missing key-value pair', async () => {
    expect(booleanType.has('TO_REMOVE_MISSING')).toBe(false);

    booleanType.delete('TO_REMOVE_MISSING');
    expect(booleanType.has('TO_REMOVE_MISSING')).toBe(false);
  });

  it('should expose the Y.Map via the `map` field declaration', async () => {
    expect(booleanType.map).toBeInstanceOf(Y.Map);
  });
});
