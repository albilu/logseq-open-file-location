The browser SDK and its supplied license notice are copied without modification
from the exact `@logseq/libs` version in `package.json` and `package-lock.json`.
The package URL, npm integrity value, and file hashes are recorded in `sdk.json`.

Both unpacked installs and release packages use these local files. No SDK CDN
request or dependency installation is needed to load the plugin in Logseq.

To update the SDK, update the exact development dependency and lockfile, run
`npm run vendor:sdk`, and verify the plugin in Logseq. `npm run check` compares the
checked-in files and provenance with the pinned installed package.

Upstream source and API documentation: https://github.com/logseq/logseq/tree/master/libs
