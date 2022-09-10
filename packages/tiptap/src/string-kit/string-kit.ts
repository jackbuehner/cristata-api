import { Extension } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Paragraph, ParagraphOptions } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';

interface StringKitOptions {
  document: false;
  paragraph: Partial<ParagraphOptions> | false;
  text: false;
}

const ParagraphDocument = Document.extend({
  content: 'paragraph',
});

const StringKit = Extension.create<StringKitOptions>({
  name: 'stringKit',

  addExtensions() {
    const extensions = [];

    if (this.options.document !== false) {
      extensions.push(ParagraphDocument.configure(this.options?.document));
    }

    if (this.options.paragraph !== false) {
      extensions.push(Paragraph.configure(this.options?.paragraph));
    }

    if (this.options.text !== false) {
      extensions.push(Text.configure(this.options?.text));
    }

    return extensions;
  },
});

export { StringKit };
export type { StringKitOptions };
