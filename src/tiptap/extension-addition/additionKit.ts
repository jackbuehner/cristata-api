import { Extension } from '@tiptap/core';
import { Addition, AdditionEventHandler, AdditionOptions } from '.';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface AdditionKitOptions extends Partial<AdditionOptions> {}

const AdditionKit = Extension.create<AdditionKitOptions>({
  name: 'additionKit',

  addExtensions() {
    return [Addition, AdditionEventHandler];
  },
});

export { AdditionKit };
export type { AdditionKitOptions };
