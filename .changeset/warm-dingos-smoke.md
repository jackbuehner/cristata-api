---
'@jackbuehner/cristata-api': major
'@jackbuehner/cristata-hocuspocus': minor
'@jackbuehner/cristata-generator-schema': minor
---

Add support for option to edit published documents and only publish the changes when ready (instead of immediately). This adds the `__publishedDoc` field and the `_publishedDocExists` field to published documents. Public queries access the `_publishedDoc` object instead of the root document object. The `modifyDoc` helper has addition restrictions that prevent it from modifying published documents if `__publishedDoc` is enabled in the collection config. It also refuses to change the stage to `5.2`; use the `publishDoc` helper to do that, and it will also add `__publishedDoc` and `_publishedDocExists` when needed.
