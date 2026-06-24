# MCP Robustness & Standard Compliance

**Date:** 2026-06-23
**Status:** Approved
**Transport:** stdio only (Claude Desktop, LM Studio)

## Context

`family-serve-delicious` is a personal MCP server for constraint-aware family meal planning, with ambitions to become a tool usable by any family. The SDK is current (`@modelcontextprotocol/sdk ^1.25.2`) but several new protocol features are unused, and a few robustness issues would cause problems at scale.

This spec defines a prioritized set of improvements across four areas, ordered by impact-to-effort ratio.

---

## Phase 1 — Error Handling & Protocol Annotations

### McpError

**Problem:** All errors thrown from tool handlers (sanitization rejections, group not found, DB failures) are caught by the SDK and converted to a generic `InternalError`. Clients cannot distinguish invalid input from a server fault.

**Solution:** Import and throw `McpError` with appropriate error codes at each failure point:

- `ErrorCode.InvalidParams` — input rejected by sanitizer, resource not found (group, members)
- `ErrorCode.InternalError` — unexpected DB error or unhandled exception

The existing `wrapHandlerWithValidation` in `index.ts` is updated to catch unexpected errors and re-throw as `McpError(InternalError)` rather than letting them propagate raw.

```typescript
// Before
if (!group) return { content: [{ type: 'text', text: `No group found: ${id}` }] };

// After
if (!group) throw new McpError(ErrorCode.InvalidParams, `No group found: ${id}`);
```

The "not found" soft-return pattern (returning a text content with no structuredContent) is eliminated entirely — not-found is an invalid param, not a valid empty result.

### Tool Annotations

**Problem:** The 4 tools (`find-group-by-name`, `groups-summary`, `group-recipe-context`, `find-members-by-restriction`) are all read-only but carry no annotation. Clients that inspect annotations (e.g. for safety UI) see nothing.

**Solution:** Add `annotations` to each tool registration:

```typescript
{
    readOnlyHint: true,
    openWorldHint: false  // tools only access local MongoDB, no external APIs
}
```

No tool modifies data, so `destructiveHint` is irrelevant and can be omitted.

---

## Phase 2 — Performance & Reliability

### Prompt File Cache

**Problem:** `readPromptFile()` calls `fs.readFileSync` on every prompt invocation. This blocks the event loop on each call and fails mid-conversation if a file is missing or corrupted.

**Solution:** Introduce `initializePromptCache()`, called once inside `start()` before the transport connects. It reads all 9 prompt files (3 languages × 3 formats) eagerly into a `Map<string, string>`:

```typescript
const promptCache = new Map<string, string>(); // key: `${lang}:${format}`

const initializePromptCache = () => {
    for (const lang of ['en', 'fr', 'es'] as Language[]) {
        for (const format of ['full', 'short', 'template'] as PromptFormat[]) {
            const content = fs.readFileSync(resolvePromptPath(lang, format), 'utf-8');
            promptCache.set(`${lang}:${format}`, content);
        }
    }
};
```

If any file is missing at startup, the server throws immediately with a clear message before accepting any connections — fail-fast rather than fail mid-conversation.

`readPromptFile` becomes a synchronous cache lookup with no I/O.

### Real Database Pagination

**Problem:** `getGroupsSummaryHandler` calls `listGroups()` which fetches all groups from MongoDB, then slices the result in application memory. With many groups this loads the full collection on every `groups-summary` call.

**Solution:** Pass `limit` and `offset` to the DB layer: `getGroupService().listGroups({ limit, offset })`. The `total` count is fetched via a separate `countGroups()` call (or returned as part of the paginated response from the service).

If `@axyor/family-serve-database` does not yet support pagination parameters, extend it as part of this work. The external API of the tool (response shape with `total`, `count`, `limit`, `offset`, `groups`) does not change.

---

## Phase 3 — MCP Discoverability

### Resource Listing

**Problem:** `groups://` is registered with `list: undefined`. When a client sends `resources/list` at startup, the server returns an empty list. Users in Claude Desktop see no resources to browse.

**Solution:** Implement the `list` callback on the `ResourceTemplate`:

```typescript
new ResourceTemplate('groups://{groupId}', {
    list: async () => {
        const groups = await getDatabase().getGroupService().listGroups({ limit: 100 });
        return {
            resources: groups.map(g => ({
                uri: `groups://${g.id}`,
                name: g.name,
                description: `${g.members.length} member(s)`
            }))
        };
    }
})
```

Users can now browse and select groups directly from the Claude Desktop resource panel without invoking a tool first.

### Argument Completions

**Problem:** No `completion/complete` handler is registered. Clients that support argument completion (typing `lang: f` and expecting `fr`) get no suggestions.

**Solution:** Register a single completion handler via `server.setCompletionHandler()`:

- `language` — static completion: filter `['en', 'fr', 'es']` by prefix
- `groupId` — dynamic completion: query DB for groups whose ID or name starts with the partial value, return their IDs
- All other argument names — return empty `values: []`

```typescript
server.setCompletionHandler(async ({ argument }) => {
    if (argument.name === 'language') {
        const values = ['en', 'fr', 'es'].filter(l => l.startsWith(argument.value));
        return { completion: { values } };
    }
    if (argument.name === 'groupId') {
        const groups = await getDatabase().getGroupService().findByPrefix(argument.value);
        return { completion: { values: groups.map(g => g.id) } };
    }
    return { completion: { values: [] } };
});
```

If `findByPrefix` does not exist in the database package, it is added there. A fallback (full list filtered in memory) is acceptable for small collections while the DB method is not available.

---

## Phase 4 — Observability & Type Safety

### MCP Structured Logging

**Problem:** All lifecycle and validation logs go to `console.error` on stderr. They are invisible to the MCP client and cannot be filtered by log level.

**Solution:** Replace lifecycle `console.error` calls with `server.sendLoggingMessage()`:

```typescript
// Before
console.error('Successfully connected to MongoDB');

// After
await server.sendLoggingMessage({ level: 'info', data: 'Connected to MongoDB' });
```

Mapping:
- DB connect/disconnect lifecycle → `info`
- Output validation warnings → `warning`
- Startup errors → `error`
- Unexpected exceptions → `error`

**Kept as `console.error`:** security audit trail logs inside `OutputValidator` and `InputSanitizer` — these go to the rotating log file and are not appropriate for MCP client consumption.

### Prompt Args Type Safety

**Problem:** `PromptMeta.argsSchema` is typed as `Record<string, any>`, allowing no runtime validation. Each handler manually casts `args as { language?: Language; ... }` with no guarantee the shape is correct.

**Solution:** Type `argsSchema` as `ZodRawShape` from zod:

```typescript
// interfaces.ts
import type { ZodRawShape } from 'zod';

export interface PromptMeta {
    title: string;
    description: string;
    argsSchema?: ZodRawShape;
}
```

Add a shared `validatePromptArgs<T>(schema: ZodRawShape, args: unknown): T` utility that calls `z.object(schema).parse(args)` and wraps `ZodError` into `McpError(InvalidParams)`. Each prompt handler calls this at the top instead of casting.

---

## Architecture: What Does Not Change

- Transport: stdio only, no HTTP
- Security layer: `InputSanitizer` and `OutputValidator` are unchanged
- Data model: no changes to group/member schema
- MongoDB: same connection lifecycle, only query layer extended for pagination and prefix search
- Prompt file formats: same `.md` / `.json` files, only loading strategy changes

---

## Execution Order

| Phase | Item | Effort | Dependency |
|-------|------|--------|------------|
| 1 | `McpError` in all tool handlers | S | none |
| 1 | Tool annotations | XS | none |
| 2 | Prompt file cache | S | none |
| 2 | Real DB pagination | M | DB package may need extension |
| 3 | Resource listing | S | none |
| 3 | Argument completions | M | DB package may need `findByPrefix` |
| 4 | MCP structured logging | S | none |
| 4 | Prompt args type safety | S | McpError (Phase 1) |

Phases 1 and 4 are fully independent and can be done in parallel. Phase 3 depends on no other phase but may block on DB package availability for the dynamic completion.

---

## Testing

- **Unit:** each tool handler tested for `McpError` on invalid/missing input (replacing the current soft-return assertions)
- **Unit:** prompt cache tested for fail-fast on missing file at init
- **Unit:** completion handler tested for static (`language`) and empty-prefix cases
- **Integration:** `groups-summary` tested against a seeded DB to verify only the requested slice is returned
- **Integration:** `resources/list` verified to return all seeded groups as URIs
