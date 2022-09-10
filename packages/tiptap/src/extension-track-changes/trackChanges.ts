import { Extension } from '@tiptap/core';
import { AdditionKit } from '../extension-addition';
import { DeletionKit } from '../extension-deletion';
import { ManageChanges } from '../extension-manage-changes';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface TrackChangesOptions {}

const TrackChanges = Extension.create<TrackChangesOptions>({
  name: 'trackChanges',

  addExtensions() {
    return [DeletionKit, AdditionKit, ManageChanges];
  },
});

export { TrackChanges };
export type { TrackChangesOptions };
