---
'@jackbuehner/cristata-ydoc-utils': patch
---

Handle case where string, int, or float values are not already options. This can occur when changing a field that was previously a free field that could have any value into a field that has a selection of options. Fields of options are expected to store their values as an array of selected options, but when they are converted, they might become an array of YXMLFragments or an array of strings. These arrays must be transformed into an array of options. If options are provided to the get function, values will be removed if they are not options in the options array, ensuring that unexpected values are not stored in the ydoc after a modification is made.
