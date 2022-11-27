---
'@jackbuehner/cristata-ydoc-utils': patch
---

Do not provide tiptap value from state when isHTMLkey is a true value.

This key states if the body value is not tiptap/prosemirror JSON.
If the value of this key is true, we should skip providing a value
for this field since it is supposedly HTML or Markdown that should
not be modified.
