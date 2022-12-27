---
'@jackbuehner/cristata-api': minor
---

Referenced documents are now resolved by identifying referenced documents with the projection. Documents that have compatible projections will share the same promise, reducing the amount of time it takes to resolve documents – especially when the same documents are referenced multiple times.
