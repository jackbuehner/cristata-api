---
'@jackbuehner/cristata-api': patch
---

Do not attempt to modify user permission objects. Before `resolveReferencedDocuments` was added, it was necessary to manually convert user ids into user docs. Now, `resolveReferencedDocuments` does this already. Attempting to covert the user docs causes an error because the user doc cannot be interpreted as an objectId.
