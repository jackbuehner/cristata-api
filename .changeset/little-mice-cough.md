---
'@jackbuehner/cristata-hocuspocus': patch
'@jackbuehner/cristata-api': patch
---

Use AWS credentials from env variables instead of from tenant configs. For a while now, tenants have not needed to supply their own credentials, but now credentials for the Cristata AWS account do not need to be stored in every tenant's config
