import { Editor, Extensions } from '@tiptap/core';
import Collaboration from '@tiptap/extension-collaboration';
import * as Y from 'yjs';

function getTipTapEditorJson(field: string, document: Y.Doc, extensions: Extensions): Promise<string> {
  // get current value
  const current = document.getXmlFragment(field);

  let tiptap: Editor;

  const promise = new Promise<string>((resolve) => {
    // initialize an editor using the current fragment
    tiptap = new Editor({
      extensions: [...extensions, Collaboration.configure({ fragment: current })],
      onUpdate({ editor }) {
        // get the current json from the editor
        const json = JSON.stringify(editor.getJSON().content);

        // resolve with editor json
        resolve(json);
      },
    });
  }).finally(() => {
    // destroy tiptap editor
    tiptap.destroy();
  });

  // return promise
  return promise;
}

export { getTipTapEditorJson };
