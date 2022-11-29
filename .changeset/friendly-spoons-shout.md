---
'@jackbuehner/cristata-generator-schema': major
'@jackbuehner/cristata-api': minor
---

Store uuid instead of location of file. Location of file can be determined based on tenant name and uuid. Additionally, the correct way to retrieve a file is now by using /filestore/:tenant/:\_id. \_id is the document's object id. The server will get the document with \_id to determine the file type, file display name, and file uuid. The server will build the url to the file and pipe a request to that url.
