---
'@jackbuehner/cristata-api': minor
---

Add better protections against deletion of user documents that are referenced in other collections. Fall back to internal-deleted-user when a user cannot be found (likely because it was deleted). Add a query to determine if a user is referenced in other collections. The query will always return the number of referenced docs in each collection. It will only provide an array of document \_ids that the currently authenticated user can access.
