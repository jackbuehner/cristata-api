---
'@jackbuehner/cristata-hocuspocus': patch
'@jackbuehner/cristata-api': patch
---

Require authentication when `require_auth === true` for File collection.

Correctly return 401 error instead of 403 error when requests to the server are not authenticated at all.
