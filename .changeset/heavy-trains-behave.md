---
'@jackbuehner/cristata-hocuspocus': patch
---

throw error when database connection is not established in order to prevent errors with `mongoose.connection.db` not being defined
