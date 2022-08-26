import { Extension } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Paragraph, ParagraphOptions } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { Slice } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';

interface IntegerKitOptions {
  document: false;
  paragraph: Partial<ParagraphOptions> | false;
  integer: false;
}

const ParagraphDocument = Document.extend({
  content: 'paragraph',
});

const Integer = Text.extend({
  addProseMirrorPlugins() {
    const schema = this.editor.schema;

    return [
      new Plugin({
        key: new PluginKey('eventHandler'),
        props: {
          handleTextInput(view, from, to, text) {
            // cancel input if it contains non-numeric character
            if (text.match(/[^0-9]/g)) return true;

            return false;
          },
          handlePaste(view, event, slice) {
            const json = slice.toJSON();
            const tr = view.state.tr;
            if (json?.content[0].content[0].text) {
              const text = json.content[0].content[0].text;

              // replace invalid characters and then insert the string
              json.content[0].content[0].text = text.replace(/[^0-9]/g, '');
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

const IntegerKit = Extension.create<IntegerKitOptions>({
  name: 'integerKit',

  addExtensions() {
    const extensions = [];

    if (this.options.document !== false) {
      extensions.push(ParagraphDocument.configure(this.options?.document));
    }

    if (this.options.paragraph !== false) {
      extensions.push(Paragraph.configure(this.options?.paragraph));
    }

    if (this.options.integer !== false) {
      extensions.push(Integer.configure(this.options?.integer));
    }

    return extensions;
  },
});

export { IntegerKit };
export type { IntegerKitOptions };
