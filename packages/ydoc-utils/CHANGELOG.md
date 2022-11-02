# @jackbuehner/cristata-ydoc-utils

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
