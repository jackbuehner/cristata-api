# @jackbuehner/cristata-generator-schema

## 3.9.0

### Minor Changes

- 56c8b3b: add column defs for photo collection

## 3.8.0

### Minor Changes

- 7c1c86a: add events collection to store listener results (and results from any other types of events added in the future)
- 7c1c86a: add webhooks collection for storing webhook configurations

## 3.7.0

### Minor Changes

- cbe6e90: add config for profiles app field descriptions, support setting action access for users collection, use tenant name instead of hardcoded string when updating a collection, and use database listener to update config instead of manually updating the config in the Cristata instance
- 41dc22e: track history in the activity collection
- 4c70379: upgrade to mongoose 7 (supports mongodb 6)
- 1a222f0: support non-lean mongoose documents when modifying doc based on setters
- 1a222f0: support getting schema fields that cannot be required

## 3.6.0

### Minor Changes

- 4cfc32d: support collapsed option on field defs

## 3.5.0

### Minor Changes

- b574b0d: Add support for option to edit published documents and only publish the changes when ready (instead of immediately). This adds the `__publishedDoc` field and the `_publishedDocExists` field to published documents. Public queries access the `_publishedDoc` object instead of the root document object. The `modifyDoc` helper has addition restrictions that prevent it from modifying published documents if `__publishedDoc` is enabled in the collection config. It also refuses to change the stage to `5.2`; use the `publishDoc` helper to do that, and it will also add `__publishedDoc` and `_publishedDocExists` when needed.

## 3.4.0

### Minor Changes

- 7108a1b: support editing nav pane groups and their items

## 3.3.0

### Minor Changes

- 5c89488: add `dynamicPreviewHref` to schema options

## 3.2.0

### Minor Changes

- d9f5180: add photos collection as a system collection (similar to files)

## 3.1.0

### Minor Changes

- cfb71f3: require authentication when `require_auth === true` for File collection

## 3.0.0

### Major Changes

- 526985b: Store uuid instead of location of file. Location of file can be determined based on tenant name and uuid. Additionally, the correct way to retrieve a file is now by using /filestore/:tenant/:\_id. \_id is the document's object id. The server will get the document with \_id to determine the file type, file display name, and file uuid. The server will build the url to the file and pipe a request to that url.

## 2.5.0

### Minor Changes

- e08b8a3: Add the files collection, which supports storing references to uploaded files in AWS S3. The files collection is a system collection, but it's action access can still be edited by tenants.

## 2.4.0

### Minor Changes

- d21d1ec: add feature booleans for tables and fotns

## 2.3.0

### Minor Changes

- d80a2ff: add css and attribute fields to tiptap field def

## 2.2.1

### Patch Changes

- bad6e9f: chore: fix release script to build packages

## 2.2.0

### Minor Changes

- 5eaad7e: support specifying that a field should only appear in the publish modal

## 2.1.0

### Minor Changes

- 768c5f0: add helper and mutation to clone a collection document

## 2.0.1

### Patch Changes

- 1a91596: include User schema in hocuspocus server

## 2.0.0

### Major Changes

- f7499e8: handle document saves through new server used for collaborative editing

## 1.1.0

### Minor Changes

- 3c13c2f: This change converts the existing api/server package into multiple packages that are related. The repository is now a monorepo powered by turborepo.
