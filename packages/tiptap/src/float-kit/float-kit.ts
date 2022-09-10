import { Extension } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Paragraph, ParagraphOptions } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { Slice } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';

interface FloatKitOptions {
  document: false;
  paragraph: Partial<ParagraphOptions> | false;
  float: false;
}

const ParagraphDocument = Document.extend({
  content: 'paragraph',
});

const Float = Text.extend({
  addProseMirrorPlugins() {
    const schema = this.editor.schema;

    return [
      new Plugin({
        key: new PluginKey('eventHandler'),
        props: {
          handleTextInput(view, from, to, text) {
            const hasDecimal = view.state.doc.textContent.includes('.');

            if (hasDecimal) {
              // cancel input if it contains non-numeric character
              if (text.match(/[^0-9]$/)) return true;
            } else {
              // cancel input if it contains non-numeric or non-decimal character
              if (text.match(/[^0-9,.]$/)) return true;
            }

            return false;
          },
          handlePaste(view, event, slice) {
            const json = slice.toJSON();
            const tr = view.state.tr;
            if (json?.content[0].content[0].text) {
              const text = json.content[0].content[0].text;

              // replace invalid characters and then insert the string
              json.content[0].content[0].text = text.replace(/(?<=(.*\..*))\./g, '');
              view.dispatch(tr.replaceSelection(Slice.fromJSON(schema, json)));
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});

const FloatKit = Extension.create<FloatKitOptions>({
  name: 'floatKit',

  addExtensions() {
    const extensions = [];

    if (this.options.document !== false) {
      extensions.push(ParagraphDocument.configure(this.options?.document));
    }

    if (this.options.paragraph !== false) {
      extensions.push(Paragraph.configure(this.options?.paragraph));
    }

    if (this.options.float !== false) {
      extensions.push(Float.configure(this.options?.float));
    }

    return extensions;
  },
});

export { FloatKit };
export type { FloatKitOptions };
