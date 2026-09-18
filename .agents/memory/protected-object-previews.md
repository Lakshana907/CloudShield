---
name: Protected object previews
description: Browser file previews for Clerk-authenticated App Storage objects must carry a session bearer token.
---

Protected App Storage object requests should use the Clerk session token explicitly rather than relying on a raw anchor or new-tab navigation.

**Why:** Project API requests succeeded while direct `/api/storage/objects/...` navigation returned 401, so uploaded files could not be reviewed from the room.

**How to apply:** Fetch the protected object with `getToken()` and an `Authorization: Bearer` header, create a blob URL for preview/download, and keep the storage route authenticated.