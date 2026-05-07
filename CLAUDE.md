<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Common bugs to avoid

### Convex: `"use node"` required for all files in `convex/actions/`
Every file inside `convex/actions/` **must** have `"use node"` as its first line, even if the action only uses `ctx.runQuery` / `ctx.runAction` (V8-compatible ops). Omitting it causes a Convex deployment error:
> "file is in /actions subfolder but has no 'use node' directive"

```ts
// convex/actions/myAction.ts
"use node";
import { internalAction } from "../_generated/server";
```

### Convex: queries and mutations cannot live in `"use node"` files
Only `action` / `internalAction` exports are allowed in Node.js files. Putting a `mutation` or `query` in a file with `"use node"` causes:
> "X defined in foo.js is a Mutation function. Only actions can be defined in Node.js."

Split the file: keep actions in the `"use node"` file, move queries/mutations to a separate V8 file (e.g. `fooInternal.ts`).

### Convex: async `.map()` must be wrapped in `Promise.all`
Inside a Convex query/mutation handler, `array.map(async fn)` returns `Promise<T>[]`, not `T[]`. The handler must return a single promise:

```ts
// Wrong — handler returns Promise<T>[] which Convex can't await
return teams.map(async (t) => { ... });

// Correct
return Promise.all(teams.map(async (t) => { ... }));
```

### Statbotics EPA field path
The Statbotics `/team_event` response nests EPA: `data.epa.total_points.mean` (not `data.epa` or `data.epa.mean`). Always extract as:
```ts
const epaRaw = data?.epa;
const epa: number =
  typeof epaRaw === "number"
    ? epaRaw
    : (epaRaw?.total_points?.mean ?? epaRaw?.mean ?? 0);
```

### TypeScript circularity from stale generated types
When a new Convex file is created, `_generated/api.ts` isn't regenerated until `npx convex dev` runs. This causes:
> "'foo' implicitly has type 'any'... referenced directly or indirectly in its own initializer"

Fix: add explicit return type annotations on the action handler (`Promise<void>`, `Promise<{ field: type }>`, etc.) and annotate intermediate variables that `runQuery` returns.
