---
'@jackbuehner/cristata-api': patch
---

Enable child doc resolution on user query. This was broken on the switch to the new child doc resolution method because the users collection impliments its own resolver for retrieving a single user.
