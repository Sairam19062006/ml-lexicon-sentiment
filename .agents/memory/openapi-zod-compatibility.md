---
name: OpenAPI Zod compatibility
description: A generator/runtime compatibility constraint affecting integer schemas in this workspace
---

The current OpenAPI generator can emit `zod.int()`, but the workspace is pinned to Zod 3 where that API is unavailable.

**Why:** Code generation succeeds before the chained library typecheck, so this mismatch can look like a downstream mystery after a valid spec change.

**How to apply:** When adding API schemas in this workspace, prefer numeric schemas that do not trigger `zod.int()` or update the generator/runtime pair together and rerun library code generation.