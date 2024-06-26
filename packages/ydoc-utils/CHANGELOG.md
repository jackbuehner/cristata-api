# @jackbuehner/cristata-ydoc-utils

## 3.2.0

### Minor Changes

- 043af12: update doc array values when the shared types within the doc array are retrieved

## 3.1.2

### Patch Changes

- d9f5180: in `addToY.ts`, handle case where json field data is undefined

## 3.1.1

### Patch Changes

- 999334b: Do not provide tiptap value from state when isHTMLkey is a true value.

  This key states if the body value is not tiptap/prosemirror JSON.
  If the value of this key is true, we should skip providing a value
  for this field since it is supposedly HTML or Markdown that should
  not be modified.

## 3.1.0

### Minor Changes

- 5e52777: support nested doc arrays

## 3.0.3

### Patch Changes

- ee8840b: - remove undefined or null array values in YArray getter
  - fall back to empty array when default array is missing
  - fix: use correct array type checks

## 3.0.2

### Patch Changes

- ed41db2: Handle case where string, int, or float values are not already options. This can occur when changing a field that was previously a free field that could have any value into a field that has a selection of options. Fields of options are expected to store their values as an array of selected options, but when they are converted, they might become an array of YXMLFragments or an array of strings. These arrays must be transformed into an array of options. If options are provided to the get function, values will be removed if they are not options in the options array, ensuring that unexpected values are not stored in the ydoc after a modification is made.

## 3.0.1

### Patch Changes

- bad6e9f: chore: fix release script to build packages

## 3.0.0

### Major Changes

- f7499e8: update ydoc utils to handle all cases and references

  With the addition of tests for every ydoc util, setting and retrieving data becomes more predictible and reliable. Things that were previously supported in the web app are now supported in this package, including getting data from referenced collections (or not), predictable return types, and correct doc array values.

- f7499e8: handle document saves through new server used for collaborative editing

## 2.0.1

### Patch Changes

- dd4416d: add util for replacing circular references in objects to replace circular references before stingifying errors for logtail

## 2.0.0

### Major Changes

- 0f6e4c7: update ydoc utils to handle all cases and references

  With the addition of tests for every ydoc util, setting and retrieving data becomes more predictible and reliable. Things that were previously supported in the web app are now supported in this package, including getting data from referenced collections (or not), predictable return types, and correct doc array values.

## 1.1.1

### Patch Changes

- 2a8476f: add logtail error logging

## 1.1.0

### Minor Changes

- 3c13c2f: This change converts the existing api/server package into multiple packages that are related. The repository is now a monorepo powered by turborepo.
