# @jackbuehner/cristata-hocuspocus

## 2.0.0

### Major Changes

- 012aa85: add external accounts collection and app

### Patch Changes

- 50cba22: force a reconnect when a published doc switches to an edit session, but also do not clear text fields

## 1.6.0

### Minor Changes

- 043af12: update doc array values when the shared types within the doc array are retrieved

### Patch Changes

- ab697de: do not destructure array into set when setting users array in activity doc
- 4d4db78: do not store activty in response to no change
- dd6ca5d: support date accessor on hocuspocus server

## 1.5.0

### Minor Changes

- 41dc22e: track history in the activity collection
- 4c70379: upgrade to mongoose 7 (supports mongodb 6)
- b50a367: reduce ydoc versions array length when doc is too large

### Patch Changes

- 1a222f0: do not attempt to cast objectId if hexId is not correct length during update and history logic in the `onDisconnect` function
- 88dff8f: do not attempt to set history for a doc if the user id hex string is not 24 characters long

## 1.4.0

### Minor Changes

- b574b0d: Add support for option to edit published documents and only publish the changes when ready (instead of immediately). This adds the `__publishedDoc` field and the `_publishedDocExists` field to published documents. Public queries access the `_publishedDoc` object instead of the root document object. The `modifyDoc` helper has addition restrictions that prevent it from modifying published documents if `__publishedDoc` is enabled in the collection config. It also refuses to change the stage to `5.2`; use the `publishDoc` helper to do that, and it will also add `__publishedDoc` and `_publishedDocExists` when needed.

## 1.3.1

### Patch Changes

- ece1ead: allow dotenv to override env variables

## 1.3.0

### Minor Changes

- d9f5180: add photos collection as a system collection (similar to files)

### Patch Changes

- d9f5180: hocuspocus server: in `setDocValues.ts`, wrap `addToY` in a try-catch block to improve error diagnosis

## 1.2.2

### Patch Changes

- cfb71f3: Require authentication when `require_auth === true` for File collection.

  Correctly return 401 error instead of 403 error when requests to the server are not authenticated at all.

## 1.2.1

### Patch Changes

- e08b8a3: Use AWS credentials from env variables instead of from tenant configs. For a while now, tenants have not needed to supply their own credentials, but now credentials for the Cristata AWS account do not need to be stored in every tenant's config

## 1.2.0

### Minor Changes

- ee8840b: log doc json if any errors occur

### Patch Changes

- ee8840b: - remove undefined or null array values in YArray getter
  - fall back to empty array when default array is missing
  - fix: use correct array type checks

## 1.1.3

### Patch Changes

- 327348b: get users from awareness before waiting for database doc

## 1.1.2

### Patch Changes

- ed41db2: throw error when database connection is not established in order to prevent errors with `mongoose.connection.db` not being defined

## 1.1.1

### Patch Changes

- bad6e9f: chore: fix release script to build packages

## 1.1.0

### Minor Changes

- 73dc330: track list of versions in yjs shared type and fix timestamps of versions

## 1.0.2

### Patch Changes

- 1a91596: include User schema in hocuspocus server

## 1.0.1

### Patch Changes

- cffaee6: do not check app version when connecting with authSecret

## 1.0.0

### Major Changes

- f7499e8: handle document saves through new server used for collaborative editing
