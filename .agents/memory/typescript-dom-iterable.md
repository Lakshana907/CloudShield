---
name: Shared generated client TypeScript setup
description: A generated browser API client may use Headers.entries(), which requires DOM iterable typings in shared library configs.
---

Generated API clients can rely on iterable DOM APIs such as `Headers.entries()`, so shared TypeScript library configs need both `dom` and `dom.iterable` in their `lib` list.

**Why:** Code generation completed successfully but the workspace typecheck failed until the shared client library included iterable DOM typings.

**How to apply:** When a generated web client reports missing `Headers`/`FormData` iterator methods, update the client library TypeScript `lib` settings before changing generated code.