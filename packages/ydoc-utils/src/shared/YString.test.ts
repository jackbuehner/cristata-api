import * as Y from 'yjs';
import { YString } from './YString';

describe(`shared >> YString`, () => {
  const ydoc = new Y.Doc();
  let stringType: YString<string, string | null | undefined>;

  it('should create a new instance', async () => {
    stringType = new YString(ydoc);
    expect(stringType).toBeInstanceOf(YString);
  });

  describe(`>> plain strings`, () => {
    it('should set and get a plain string', async () => {
      stringType.set('PLAIN_STRING', 'Hello, my name is Jack.');
      const value = await stringType.get('PLAIN_STRING', false, false, false);
      expect(value).toBe('Hello, my name is Jack.');
    });

    it('should set an undefined value and get an empty string', async () => {
      stringType.set('PLAIN_STRING_UNDEFINED', undefined);
      const value = await stringType.get('PLAIN_STRING_UNDEFINED', false, false, false);
      expect(value).toBe('');
    });

    it('should set a null value and get an empty string', async () => {
      stringType.set('PLAIN_STRING_NULL', null);
      const value = await stringType.get('PLAIN_STRING_NULL', false, false, false);
      expect(value).toBe('');
    });
  });

  describe(`>> rich text`, () => {
    it('should set and get a rich text string', async () => {
      stringType.set('RICH_STRING', docJson, 'tiptap');
      const value = await stringType.get('RICH_STRING', false, true, false);
      expect(JSON.parse(value)).toMatchObject(docContent);
    });

    it('should set an undefined value and get a string with an empty array', async () => {
      stringType.set('RICH_STRING_UNDEFINED', undefined, 'tiptap');
      const value = await stringType.get('RICH_STRING_UNDEFINED', false, true, false);
      expect(value).toBe('[]');
    });

    it('should set a null value and get a string with an empty array', async () => {
      stringType.set('RICH_STRING_NULL', null, 'tiptap');
      const value = await stringType.get('RICH_STRING_NULL', false, true, false);
      expect(value).toBe('[]');
    });
  });

  describe(`>> code`, () => {
    it('should set and get a code string', async () => {
      stringType.set('CODE_STRING', '{ "key": "value" }', 'code');
      const value = await stringType.get('CODE_STRING', false, false, true);
      expect(value).toBe('{ "key": "value" }');
    });

    it('should set an undefined value and get an empty string', async () => {
      stringType.set('CODE_STRING_UNDEFINED', undefined, 'code');
      const value = await stringType.get('CODE_STRING_UNDEFINED', false, false, true);
      expect(value).toBe('');
    });

    it('should set a null value and get an empty string', async () => {
      stringType.set('CODE_STRING_NULL', null, 'code');
      const value = await stringType.get('CODE_STRING_NULL', false, false, true);
      expect(value).toBe('');
    });
  });

  describe(`>> array of strings`, () => {
    it('should set an array of strings and get an array of options with the same label and value', async () => {
      stringType.set('ARRAY', ['Hi!', 'My name is Jack.', 'I created Cristata.']);
      const value = await stringType.get('ARRAY', true, false, false);
      expect(value).toMatchObject([
        { label: 'Hi!', value: 'Hi!' },
        { label: 'My name is Jack.', value: 'My name is Jack.' },
        { label: 'I created Cristata.', value: 'I created Cristata.' },
      ]);
    });

    it('should set an array of strings and use the provided options before generating a custom option', async () => {
      stringType.set(
        'ARRAY',
        ['Hi!', 'My name is Jack.', 'create_message'],
        [
          { label: 'I created Cristata.', value: 'create_message' },
          { label: 'I made Cristata.', value: 'alt_create_message' },
        ]
      );
      const value = await stringType.get('ARRAY', true, false, false);
      expect(value).toMatchObject([
        { label: 'Hi!', value: 'Hi!' },
        { label: 'My name is Jack.', value: 'My name is Jack.' },
        { label: 'I created Cristata.', value: 'create_message' },
      ]);
    });

    it('should remove undefined values from the array', async () => {
      stringType.set('ARRAY_UNDEFINED', [undefined, undefined]);
      const value = await stringType.get('ARRAY_UNDEFINED', true, false, false);
      expect(value).toHaveLength(0);
    });

    it('should remove null values from the array', async () => {
      stringType.set('ARRAY_NULL', [null, null]);
      const value = await stringType.get('ARRAY_NULL', true, false, false);
      expect(value).toHaveLength(0);
    });
  });

  describe('>> existence', () => {
    it('should return true when checking presence of an existing key-value pair', async () => {
      stringType.set('EXISTING', 'Hello, my name is Jack.');
      const value = stringType.has('EXISTING');
      expect(value).toBe(true);
    });

    it('should return false when checking presence of a missing key-value pair', async () => {
      const value = stringType.has('MISSING_NUMBER');
      expect(value).toBe(false);
    });
  });

  describe('>> removal', () => {
    it('should successfully remove a key-value pair', async () => {
      stringType.set('TO_REMOVE', 'Hello!');
      expect(stringType.has('TO_REMOVE')).toBe(true);

      stringType.delete('TO_REMOVE');
      expect(stringType.has('TO_REMOVE')).toBe(false);
    });

    it('should do nothing on attempt to remove a missing key-value pair', async () => {
      expect(stringType.has('TO_REMOVE_MISSING')).toBe(false);

      stringType.delete('TO_REMOVE_MISSING');
      expect(stringType.has('TO_REMOVE_MISSING')).toBe(false);
    });
  });
});

const docContent = [
  {
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: 'What we are involved in becomes a part of our identities at Furman. Our involvements inform the way we view ourselves and how we introduce ourselves around campus. With such weight to them, these identifiers ',
      },
      {
        type: 'text',
        marks: [
          {
            type: 'italic',
          },
        ],
        text: 'do',
      },
      {
        type: 'text',
        text: ' help us meet and learn about others, but there is a flip side to perceiving people based on their affiliations. When unchecked, our categorizing and thinking of each other in this way becomes stereotyping, and it prevents us from doing the necessary work of truly getting to know one another – underneath the labels.',
      },
    ],
  },
];

const docJson = JSON.stringify(docContent);
