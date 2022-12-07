# @jackbuehner/cristata-hocuspocus

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
