import { YDate } from './YDate';
import * as Y from 'yjs';

describe(`shared >> YDate`, () => {
  const ydoc = new Y.Doc();
  let dateType: YDate<string, string | undefined | null>;

  const validDate = '2022-09-12T03:53:04.008Z';

  it('should create a new instance', async () => {
    dateType = new YDate(ydoc);
    expect(dateType).toBeInstanceOf(YDate);
  });

  it('should set and get a valid ISO 8601 date string', async () => {
    dateType.set('VALID_DATE', validDate);
    const value = dateType.get('VALID_DATE');
    expect(value).toBe(validDate);
  });

  it('should set an invalid ISO 8601 date string and get an empty string', async () => {
    dateType.set('INVALID_DATE', 'bad_date');
    const value = dateType.get('INVALID_DATE');
    expect(value).toBe('');
  });

  it('should set an undefined date and get an empty string', async () => {
    dateType.set('UNDEFINED_DATE', undefined);
    const value = dateType.get('UNDEFINED_DATE');
    expect(value).toBe('');
  });

  it('should set a null date and get an empty string', async () => {
    dateType.set('NULL_DATE', null);
    const value = dateType.get('NULL_DATE');
    expect(value).toBe('');
  });

  it('should return an empty string on attempt to get a missing key-value pair', async () => {
    const value = dateType.get('MISSING_DATE');
    expect(value).toBe('');
  });

  it('should return true when checking presence of an existing key-value pair', async () => {
    dateType.set('EXISTING', validDate);
    const value = dateType.has('EXISTING');
    expect(value).toBe(true);
  });

  it('should return false when checking presence of a missing key-value pair', async () => {
    const value = dateType.has('MISSING');
    expect(value).toBe(false);
  });

  it('should successfully remove a key-value pair', async () => {
    dateType.set('TO_REMOVE', validDate);
    expect(dateType.has('TO_REMOVE')).toBe(true);

    dateType.delete('TO_REMOVE');
    expect(dateType.has('TO_REMOVE')).toBe(false);
  });

  it('should do nothing on attempt to remove a missing key-value pair', async () => {
    expect(dateType.has('TO_REMOVE_MISSING')).toBe(false);

    dateType.delete('TO_REMOVE_MISSING');
    expect(dateType.has('TO_REMOVE_MISSING')).toBe(false);
  });
});
