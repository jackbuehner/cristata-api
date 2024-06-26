import { Node } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sweepwidgetWidget: {
      insertSweepwidgetWidget: (id: string) => ReturnType;
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface SweepwidgetWidgetOptions {}

const SweepwidgetWidget = Node.create<SweepwidgetWidgetOptions>({
  name: 'sweepwidgetWidget',

  // only allow zero or more inline nodes
  content: 'text*',

  group: 'block',

  draggable: false,

  allowGapCursor: false,

  /**
   *
   */
  addAttributes() {
    return {
      id: {
        default: 'undefined',
        renderHTML: (attributes) => ({
          'data-id': attributes.id,
        }),
        parseHTML: (element) => element.getAttribute('data-id') || 'undefined',
      },
    };
  },

  /**
   *
   */
  renderHTML({ HTMLAttributes }) {
    return ['sweepwidgetWidget', HTMLAttributes, 0];
  },

  /**
   *
   */
  parseHTML() {
    return [{ tag: 'sweepwidgetWidget' }];
  },

  /**
   *
   */
  addCommands() {
    return {
      insertSweepwidgetWidget:
        (id: string) =>
        ({ state, dispatch }) => {
          if (dispatch) {
            // remove anything within the selection
            state.tr.deleteRange(state.selection.from, state.selection.to);

            // split the node twice where the caret is located
            // (this creates an empty node between two nodes with content)
            state.tr.split(state.selection.from);
            state.tr.split(state.selection.from);

            // set the type of the empty node to the sweepwidget type
            state.tr.setBlockType(state.selection.from - 2, state.selection.to - 2, this.type, { id });

            return dispatch(state.tr);
          }

          return false;
        },
    };
  },

  addNodeView() {
    return () => ({ dom: document.createElement('div') });
  },
});

export { SweepwidgetWidget };
export type { SweepwidgetWidgetOptions };
