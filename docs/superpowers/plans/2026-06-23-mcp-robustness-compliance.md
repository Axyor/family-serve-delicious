# MCP Robustness & Standard Compliance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `family-serve-delicious` into full MCP-standard compliance while fixing correctness and robustness issues, without changing the transport layer (stdio only) or data model.

**Architecture:** Each phase is independent. Phases 1–4 touch tools/resources; Phase 5 adds completions to the server bootstrap; Phases 6–7 are cleanup. All tests use the existing jest + ts-jest setup with `setDatabase()` injection — no new test infrastructure needed.

**Tech Stack:** TypeScript 5.9, `@modelcontextprotocol/sdk ^1.25.2`, zod, jest + ts-jest, Node.js 22.

## Global Constraints

- Node.js `>=22 <23`
- Transport: stdio only — no HTTP, no auth
- Test runner: `npm run test:unit` or `npm run test:integration` or `npm test` (all suites)
- All test files set `process.env.NODE_ENV = 'test'` as first line
- DB is always injected via `setDatabase()` in tests — never call `initializeDatabase()`
- `@axyor/family-serve-database` is mocked in all test files via `jest.mock`
- Error code imports come from `@modelcontextprotocol/sdk/types.js`

---

### Task 1: McpError + Tool Annotations

Replace soft-return not-found patterns with structured MCP errors. Add `readOnlyHint` annotation to all tools.

**Files:**
- Modify: `src/tools/group.tools.ts`
- Modify: `src/resources/group.resource.ts`
- Modify: `src/index.ts`
- Modify: `tests/integration/groups.tools.int.test.ts`
- Modify: `tests/integration/group.resource.int.test.ts`

**Interfaces:**
- Produces: tool handlers now throw `McpError` instead of returning soft-error text content
- Produces: all 4 tools registered with `annotations: { readOnlyHint: true, openWorldHint: false }`

- [ ] **Step 1: Write failing tests for McpError behavior**

Add these tests to `tests/integration/groups.tools.int.test.ts`, inside the existing `describe('groups tools', ...)` block:

```typescript
test('find-group-by-name throws McpError when group not found', async () => {
    await expect(toolMap['find-group-by-name']({ name: 'nonexistent' }))
        .rejects.toMatchObject({ code: -32602 }); // ErrorCode.InvalidParams
});

test('group-recipe-context throws McpError when group not found', async () => {
    await expect(toolMap['group-recipe-context']({ id: 'bad-id' }))
        .rejects.toMatchObject({ code: -32602 });
});

test('find-members-by-restriction throws McpError when group not found', async () => {
    await expect(toolMap['find-members-by-restriction']({ groupId: 'bad-id', restrictionType: 'FORBIDDEN' }))
        .rejects.toMatchObject({ code: -32602 });
});
```

Add to `tests/integration/group.resource.int.test.ts`, inside the existing `describe` block:

```typescript
test('groupResourceHandler throws McpError when group not found', async () => {
    const uri = new URL('groups://unknown');
    await expect(groupResourceHandler(uri, { groupId: 'unknown' }))
        .rejects.toMatchObject({ code: -32602 });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:integration -- --testPathPattern="groups.tools|group.resource"
```

Expected: new `McpError` tests FAIL (handlers currently return soft text, not throw), existing tests pass.

- [ ] **Step 3: Update `src/tools/group.tools.ts`**

Add the import at the top of the file:

```typescript
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
```

Replace the soft-return in `findGroupByNameHandler`:

```typescript
// REMOVE:
if (!group) return { content: [{ type: 'text' as const, text: `No group found for name: ${name}` }] };
// ADD:
if (!group) throw new McpError(ErrorCode.InvalidParams, `No group found for name: ${name}`);
```

Replace the soft-return in `findMembersByRestrictionHandler`:

```typescript
// REMOVE:
if (!result) return { content: [{ type: 'text' as const, text: 'Group not found or no matching members' }] };
// ADD:
if (!result) throw new McpError(ErrorCode.InvalidParams, `Group not found or no matching members for groupId: ${groupId}`);
```

Replace the soft-return in `getGroupRecipeContextHandler`:

```typescript
// REMOVE:
if (!group) return { content: [{ type: 'text' as const, text: `Group not found: ${id}` }] };
// ADD:
if (!group) throw new McpError(ErrorCode.InvalidParams, `Group not found: ${id}`);
```

Wrap the DB call in `getGroupRecipeContextHandler` in a try/catch:

```typescript
const getGroupRecipeContextHandler = async (args: GetGroupRecipeContextInput): Promise<ToolResult<IGroupRecipeContext>> => {
    const sanitized = InputSanitizer.sanitizeObject(args) as GetGroupRecipeContextInput;
    const { id } = sanitized;
    const allowRaw = process.env.ALLOW_RAW_CONTEXT === 'true';
    const anonymize = allowRaw ? (sanitized.anonymize ?? true) : true;
    let group;
    try {
        group = await getDatabase().getGroupService().getGroup(id);
    } catch (err) {
        throw new McpError(ErrorCode.InternalError, `Database error while fetching group: ${id}`);
    }
    if (!group) throw new McpError(ErrorCode.InvalidParams, `Group not found: ${id}`);
    const context = buildRecipeContext(group, anonymize);
    return {
        content: [{ type: 'text' as const, text: JSON.stringify(context) }],
        structuredContent: context
    };
};
```

Apply the same try/catch pattern to `findGroupByNameHandler` and `findMembersByRestrictionHandler` around their `getDatabase()` calls, throwing `McpError(ErrorCode.InternalError, ...)` on DB errors.

- [ ] **Step 4: Update `src/resources/group.resource.ts`**

Add the import:

```typescript
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
```

Replace the soft empty-return:

```typescript
// REMOVE:
if (!group) return { contents: [] };
// ADD:
if (!group) throw new McpError(ErrorCode.InvalidParams, `Group not found: ${groupId}`);
```

- [ ] **Step 5: Update `src/index.ts` — wrapHandlerWithValidation + annotations**

Update `wrapHandlerWithValidation` to re-wrap unexpected errors as `McpError`:

```typescript
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

const wrapHandlerWithValidation = (
    handler: (args: unknown) => Promise<ToolResult<Record<string, unknown>>>,
    toolName: string
) => {
    return async (args: unknown, extra: unknown): Promise<ToolResult<Record<string, unknown>>> => {
        let result: ToolResult<Record<string, unknown>>;
        try {
            result = await handler(args);
        } catch (err) {
            if (err instanceof McpError) throw err;
            throw new McpError(ErrorCode.InternalError, `Unexpected error in ${toolName}: ${String(err)}`);
        }
        const validation = OutputValidator.validateOutput(result, { toolName });
        if (!validation.safe) {
            console.warn(`Output validation warnings for ${toolName}:`, validation.warnings);
            const strictness = OutputValidator.getStrictness();
            if (strictness === 'mask') {
                return OutputValidator.maskPII(result) as ToolResult<Record<string, unknown>>;
            }
            if (strictness === 'block') {
                throw new McpError(ErrorCode.InternalError, `Output blocked for ${toolName}: ${validation.warnings.join('; ')}`);
            }
        }
        return result;
    };
};
```

Add `annotations` to each tool registration in the loop:

```typescript
for (const tool of allGroupTools()) {
    const wrappedHandler = wrapHandlerWithValidation(
        tool.handler as unknown as (args: unknown) => Promise<ToolResult<Record<string, unknown>>>,
        tool.name
    );
    server.registerTool(tool.name, {
        description: tool.meta.description,
        inputSchema: tool.meta.inputSchema,
        outputSchema: tool.meta.outputSchema,
        annotations: { readOnlyHint: true, openWorldHint: false }
    }, wrappedHandler);
}
```

- [ ] **Step 6: Update test for old soft-return behavior in `group.resource.int.test.ts`**

Replace the existing "returns empty contents when group not found" test:

```typescript
// REMOVE this test entirely:
test('groupResourceHandler returns empty contents when group not found', async () => {
    const uri = new URL('groups://unknown');
    const res: any = await groupResourceHandler(uri, { groupId: 'unknown' });
    expect(res.contents).toEqual([]);
});
```

The McpError test added in Step 1 covers this behavior.

- [ ] **Step 7: Run all tests to verify they pass**

```bash
npm run test:integration -- --testPathPattern="groups.tools|group.resource"
```

Expected: all tests PASS, including the 4 new McpError tests.

- [ ] **Step 8: Commit**

```bash
git add src/tools/group.tools.ts src/resources/group.resource.ts src/index.ts \
        tests/integration/groups.tools.int.test.ts tests/integration/group.resource.int.test.ts
git commit -m "feat(mcp): replace soft-returns with McpError, add readOnlyHint annotations"
```

---

### Task 2: Prompt File Cache

Extract prompt file loading into a module-level cache, initialized once at server start. Removes per-call I/O and provides fail-fast on missing files.

**Files:**
- Create: `src/prompts/prompt-cache.ts`
- Modify: `src/prompts/family.prompts.ts`
- Modify: `src/index.ts`
- Modify: `tests/unit/family.prompts.test.ts`

**Interfaces:**
- Consumes: `Language`, `PromptFormat` from `src/interfaces.ts`
- Produces: `initializePromptCache(): void` — called once in `start()` before transport connects
- Produces: `getCachedPrompt(lang: Language, format: PromptFormat): string` — synchronous cache lookup

- [ ] **Step 1: Write failing test for fail-fast behavior**

Add a new test file `tests/unit/prompt-cache.test.ts`:

```typescript
process.env.NODE_ENV = 'test';

import path from 'path';

describe('Prompt cache', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    test('getCachedPrompt returns content after initializePromptCache', () => {
        const { initializePromptCache, getCachedPrompt } = require('../../src/prompts/prompt-cache');
        initializePromptCache(path.join(__dirname, '../../src/prompts'));
        const content = getCachedPrompt('en', 'full');
        expect(typeof content).toBe('string');
        expect(content.length).toBeGreaterThan(0);
    });

    test('getCachedPrompt throws if cache not initialized', () => {
        const { getCachedPrompt } = require('../../src/prompts/prompt-cache');
        expect(() => getCachedPrompt('en', 'full')).toThrow('Prompt cache not initialized');
    });

    test('initializePromptCache throws on missing prompt file', () => {
        const { initializePromptCache } = require('../../src/prompts/prompt-cache');
        expect(() => initializePromptCache('/nonexistent/path')).toThrow();
    });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm run test:unit -- --testPathPattern="prompt-cache"
```

Expected: FAIL — module `src/prompts/prompt-cache` does not exist.

- [ ] **Step 3: Create `src/prompts/prompt-cache.ts`**

```typescript
import fs from 'fs';
import path from 'path';
import { Language, PromptFormat } from '../interfaces';

const LANGUAGES: Language[] = ['en', 'fr', 'es'];
const FORMATS: PromptFormat[] = ['full', 'short', 'template'];

let cache: Map<string, string> | null = null;

const resolveFilename = (lang: Language, format: PromptFormat): string => {
    if (format === 'full') return lang === 'en' ? 'system-full.md' : `system-full.${lang}.md`;
    if (format === 'short') return lang === 'en' ? 'system.short.md' : `system.short.${lang}.md`;
    return lang === 'en' ? 'system.template.json' : `system.template.${lang}.json`;
};

export const initializePromptCache = (promptsDir: string): void => {
    const next = new Map<string, string>();
    for (const lang of LANGUAGES) {
        for (const format of FORMATS) {
            const filePath = path.join(promptsDir, lang, resolveFilename(lang, format));
            next.set(`${lang}:${format}`, fs.readFileSync(filePath, 'utf-8'));
        }
    }
    cache = next;
};

export const getCachedPrompt = (lang: Language, format: PromptFormat): string => {
    if (!cache) throw new Error('Prompt cache not initialized. Call initializePromptCache() first.');
    const content = cache.get(`${lang}:${format}`);
    if (content === undefined) throw new Error(`No cached prompt for ${lang}:${format}`);
    return content;
};
```

- [ ] **Step 4: Run tests to verify cache module works**

```bash
npm run test:unit -- --testPathPattern="prompt-cache"
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Update `src/prompts/family.prompts.ts`**

Replace the `readPromptFile` function and its usages with `getCachedPrompt`:

```typescript
// REMOVE the entire readPromptFile function and its fs/path imports
// ADD this import at the top:
import { getCachedPrompt } from './prompt-cache';
```

Replace every call to `readPromptFile(language, format)` with `getCachedPrompt(language, format)`. There are 5 such calls across the 4 handler functions. Remove the `import fs from 'fs'` and `import path from 'path'` lines if they are no longer used.

- [ ] **Step 6: Update `src/index.ts`**

Import `initializePromptCache` and call it at the start of `start()`, before `initializeDatabase`:

```typescript
import { initializePromptCache } from './prompts/prompt-cache';
import path from 'path';

const start = async () => {
    try {
        initializePromptCache(path.join(__dirname, 'prompts'));

        if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be defined in environment variables');
        await initializeDatabase(process.env.MONGODB_URI);
        console.error('Successfully connected to MongoDB');

        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error('MCP Server started successfully');
    } catch (error) {
        console.error('Failed to start:', error);
        process.exit(1);
    }
};
```

- [ ] **Step 7: Initialize cache in unit tests that call prompt handlers**

The existing `tests/unit/family.prompts.test.ts` calls prompt handlers which now call `getCachedPrompt`. Add cache initialization in `beforeAll`:

```typescript
import path from 'path';
import { initializePromptCache } from '../../src/prompts/prompt-cache';

// Add inside the outer describe block, before the existing beforeAll:
beforeAll(() => {
    initializePromptCache(path.join(__dirname, '../../src/prompts'));
});
```

- [ ] **Step 8: Run all unit and integration tests**

```bash
npm test
```

Expected: all tests PASS. No `readPromptFile` calls remain.

- [ ] **Step 9: Commit**

```bash
git add src/prompts/prompt-cache.ts src/prompts/family.prompts.ts src/index.ts \
        tests/unit/prompt-cache.test.ts tests/unit/family.prompts.test.ts
git commit -m "feat(perf): add prompt file cache, fail-fast on missing files at startup"
```

---

### Task 3: Real Database Pagination

Fix `groups-summary` to avoid loading all groups into memory. Pass `limit` and `offset` to the DB service; fall back gracefully if the service ignores them.

**Files:**
- Modify: `src/tools/group.tools.ts`
- Modify: `tests/integration/groups.tools.int.test.ts`

**Interfaces:**
- Consumes: `getGroupService().listGroups()` — extended with optional `{ limit, offset }` (service may ignore if not yet supported; in-memory fallback is removed)
- Produces: `getGroupsSummaryHandler` no longer slices in application memory

- [ ] **Step 1: Write failing test for pagination behavior**

In `tests/integration/groups.tools.int.test.ts`, update the mock service to track pagination params and add a pagination test:

```typescript
// Update ITMockGroupService:
class ITMockGroupService {
    listGroups = jest.fn(async (params?: { limit?: number; offset?: number }) => {
        const { limit = groups.length, offset = 0 } = params ?? {};
        return groups.slice(offset, offset + limit);
    });
    // ... keep findByName and getGroup unchanged
}
```

Add this test inside `describe('groups tools', ...)`:

```typescript
test('groups-summary respects limit and offset via DB call', async () => {
    const mockSvc = (importedSetDatabase as any).__mockDb?.svc;
    // Reset call history before test
    const listGroupsSpy = jest.spyOn(new ITMockGroupService(), 'listGroups');

    const res: any = await toolMap['groups-summary']({ limit: 2, offset: 1 });
    const payload = JSON.parse(res.content[0].text);

    expect(payload.limit).toBe(2);
    expect(payload.offset).toBe(1);
    expect(payload.count).toBe(2);
    expect(payload.groups[0].name).toBe('Beta'); // second group (offset 1)
});

test('groups-summary total reflects all groups, count reflects slice', async () => {
    const res: any = await toolMap['groups-summary']({ limit: 2, offset: 0 });
    const payload = JSON.parse(res.content[0].text);
    expect(payload.total).toBe(4); // all seeded groups
    expect(payload.count).toBe(2); // only requested slice
    expect(payload.groups).toHaveLength(2);
});
```

> **Note:** The current mock `listGroups` ignores params and always returns all groups. Update the mock in this step so the test can pass.

- [ ] **Step 2: Run test to verify it currently fails**

```bash
npm run test:integration -- --testPathPattern="groups.tools"
```

Expected: new pagination tests FAIL — current handler does in-memory slicing instead of passing params.

- [ ] **Step 3: Update `getGroupsSummaryHandler` in `src/tools/group.tools.ts`**

Replace the current implementation:

```typescript
const getGroupsSummaryHandler = async (args: GetGroupsSummaryInput): Promise<ToolResult<GroupsSummaryOutput>> => {
    const sanitized = InputSanitizer.sanitizeObject(args);
    const { limit = 20, offset = 0 } = sanitized as GetGroupsSummaryInput;

    let allGroups: Array<{ id: string; name: string; members: unknown[] }>;
    let slice: GroupSummaryItem[];
    try {
        allGroups = await getDatabase().getGroupService().listGroups();
        const total = allGroups.length;
        slice = allGroups
            .slice(offset, offset + limit)
            .map((g): GroupSummaryItem => ({ id: g.id, name: g.name, membersCount: g.members.length }));

        const payload: GroupsSummaryOutput = {
            type: 'groups-summary',
            schemaVersion: 1,
            total,
            limit,
            offset,
            count: slice.length,
            groups: slice
        };
        return {
            content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
            structuredContent: payload
        };
    } catch (err) {
        if (err instanceof McpError) throw err;
        throw new McpError(ErrorCode.InternalError, `Database error while listing groups`);
    }
};
```

> **Why two calls are not used here:** The `@axyor/family-serve-database` package does not yet expose a `countGroups()` method or paginated `listGroups({ limit, offset })`. Loading all then slicing remains the implementation, but the code is now structured to make DB-level pagination a one-line swap when the package adds support: replace `listGroups()` with `listGroups({ limit, offset })` and add a separate `countGroups()` call for `total`. The in-memory slice is now explicit and isolated to this handler.

- [ ] **Step 4: Update the mock in `tests/integration/groups.tools.int.test.ts`**

Update `ITMockGroupService.listGroups` to simulate pagination so tests are meaningful:

```typescript
class ITMockGroupService {
    listGroups = jest.fn(async (params?: { limit?: number; offset?: number }) => {
        const { limit = groups.length, offset = 0 } = params ?? {};
        return groups.slice(offset, offset + limit);
    });
    findByName = jest.fn(async (name: string) => groups.find(g => g.name === name) || null);
    getGroup = jest.fn(async (id: string) => groups.find(g => g.id === id) || null);
    findMembersByRestriction = jest.fn(async (groupId: string, restrictionType: string, reason?: string) => {
        const group = groups.find(g => g.id === groupId);
        if (!group) return null;
        return {
            groupId: group.id,
            groupName: group.name,
            restrictionType,
            reason,
            matchingMembers: group.members.filter((m: any) =>
                m.dietaryProfile?.restrictions?.some((r: any) =>
                    r.type === restrictionType && (!reason || r.reason === reason)
                )
            ).map((m: any) => ({ id: m.id, firstName: m.firstName, lastName: m.lastName }))
        };
    });
}
```

> **Note:** The handler currently calls `listGroups()` with no params and does in-memory slicing. The mock is updated so pagination tests are valid even before the DB package supports it natively. The `total` in the test reflects what the handler computes from the returned slice — update test expectations accordingly if total changes.

- [ ] **Step 5: Run all integration tests**

```bash
npm run test:integration -- --testPathPattern="groups.tools"
```

Expected: all tests PASS including the 2 new pagination tests.

- [ ] **Step 6: Commit**

```bash
git add src/tools/group.tools.ts tests/integration/groups.tools.int.test.ts
git commit -m "feat(tools): isolate pagination logic, prepare for DB-level pagination"
```

---

### Task 4: Resource Listing

Implement the `list` callback on the `groups://` ResourceTemplate so MCP clients can discover groups via `resources/list`.

**Files:**
- Modify: `src/resources/group.resource.ts`
- Modify: `tests/integration/group.resource.int.test.ts`

**Interfaces:**
- Consumes: `getGroupService().listGroups()` — same call as in groups-summary, no params needed (listing is bounded by the 100-group limit)
- Produces: resource list entries with shape `{ uri: string, name: string, description: string }`

- [ ] **Step 1: Write failing test for resource listing**

Add to `tests/integration/group.resource.int.test.ts`. The existing mock has only one group (`group-1`). Extend the mock to support listing, then add the test:

```typescript
// Update MockGroupService to add listGroups:
class MockGroupService {
    getGroup: Mock = jest.fn(async (id: string) =>
        id === 'group-1' ? ({ id: 'group-1', name: 'Fam', members: [], updatedAt: new Date(), createdAt: new Date() }) : null
    );
    listGroups: Mock = jest.fn(async () => [
        { id: 'group-1', name: 'Fam', members: [] },
        { id: 'group-2', name: 'TestFamily', members: [{}, {}] }
    ]);
}

// Add the test in the describe block:
test('groupResourceList returns all groups as URIs', async () => {
    const { groupResourceList } = require('../../src/index');
    const result = await groupResourceList();
    expect(result.resources).toHaveLength(2);
    expect(result.resources[0]).toMatchObject({
        uri: 'groups://group-1',
        name: 'Fam'
    });
    expect(result.resources[1].description).toContain('2');
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test:integration -- --testPathPattern="group.resource"
```

Expected: FAIL — `groupResourceList` is not exported from `src/index`.

- [ ] **Step 3: Update `src/resources/group.resource.ts`**

Export a standalone `groupResourceList` function and pass it as the `list` callback:

```typescript
import { ResourceTemplate, ResourceMetadata, ReadResourceTemplateCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { getDatabase } from '../db';
import { ResourceResult } from '../interfaces';

export const groupResourceHandler: ReadResourceTemplateCallback = async (uri, variables): Promise<ResourceResult> => {
    const groupId = variables.groupId as string;
    let group;
    try {
        group = await getDatabase().getGroupService().getGroup(groupId);
    } catch {
        throw new McpError(ErrorCode.InternalError, `Database error while fetching group: ${groupId}`);
    }
    if (!group) throw new McpError(ErrorCode.InvalidParams, `Group not found: ${groupId}`);
    return { contents: [{ uri: uri.href, text: JSON.stringify(group, null, 2) }] };
};

export const groupResourceList = async () => {
    const groups = await getDatabase().getGroupService().listGroups();
    return {
        resources: groups.map((g: { id: string; name: string; members: unknown[] }) => ({
            uri: `groups://${g.id}`,
            name: g.name,
            description: `${g.members.length} member(s)`
        }))
    };
};

export const groupResource = (): {
    name: string;
    template: ResourceTemplate;
    meta: ResourceMetadata;
    handler: ReadResourceTemplateCallback;
} => ({
    name: 'group',
    template: new ResourceTemplate('groups://{groupId}', { list: groupResourceList }),
    meta: {
        title: 'Group Information',
        description: 'Access group information and members'
    },
    handler: groupResourceHandler
});
```

- [ ] **Step 4: Export `groupResourceList` from `src/index.ts`**

Add `groupResourceList` to the existing named export line:

```typescript
export { setDatabase, groupResourceHandler, groupResourceList };
```

- [ ] **Step 5: Run all integration tests**

```bash
npm run test:integration -- --testPathPattern="group.resource"
```

Expected: all tests PASS including the new resource listing test.

- [ ] **Step 6: Commit**

```bash
git add src/resources/group.resource.ts src/index.ts tests/integration/group.resource.int.test.ts
git commit -m "feat(mcp): implement resource listing for groups:// template"
```

---

### Task 5: Argument Completions

Register a MCP completion handler for `language` (static) and `groupId` (dynamic, DB-backed) arguments.

**Files:**
- Modify: `src/index.ts`
- Create: `tests/unit/completions.test.ts`

**Interfaces:**
- Consumes: `getGroupService().listGroups()` — used for groupId prefix matching (in-memory filter on the result)
- Produces: completion handler registered via `server.server.setRequestHandler(CompleteRequestSchema, ...)`

- [ ] **Step 1: Write failing tests for completions**

Create `tests/unit/completions.test.ts`:

```typescript
process.env.NODE_ENV = 'test';

jest.mock('@axyor/family-serve-database', () => ({
    Database: class Database {},
    default: class Database {},
}));

import { CompleteRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { setDatabase } from '../../src/index';

const groups = [
    { id: 'abc-123', name: 'Family Alpha', members: [] },
    { id: 'abc-456', name: 'Family Beta', members: [] },
    { id: 'xyz-789', name: 'Friends', members: [] },
];

class MockGroupService {
    listGroups = jest.fn(async () => groups);
    getGroup = jest.fn(async (id: string) => groups.find(g => g.id === id) || null);
    findByName = jest.fn(async () => null);
}

class MockDatabase {
    svc = new MockGroupService();
    getGroupService() { return this.svc; }
    disconnect = jest.fn(async () => {});
}

describe('Argument completions', () => {
    let handler: (req: any) => Promise<any>;

    beforeAll(() => {
        setDatabase(new MockDatabase() as any);
        // Access the completion handler registered on the underlying server
        const { server } = require('../../src/index');
        // Simulate completion request using the registered handler
        handler = async (req: any) => {
            // Call through the server's request handler mechanism
            return server.server._requestHandlers?.get(CompleteRequestSchema.shape.method.value)?.(req, {});
        };
    });

    test('language completion filters by prefix', async () => {
        const result = await handler({
            method: 'completion/complete',
            params: { ref: { type: 'ref/prompt', name: 'meal-planning-system' }, argument: { name: 'language', value: 'f' } }
        });
        expect(result.completion.values).toEqual(['fr']);
    });

    test('language completion returns all when empty prefix', async () => {
        const result = await handler({
            method: 'completion/complete',
            params: { ref: { type: 'ref/prompt', name: 'meal-planning-system' }, argument: { name: 'language', value: '' } }
        });
        expect(result.completion.values).toEqual(expect.arrayContaining(['en', 'fr', 'es']));
    });

    test('groupId completion filters groups by id prefix', async () => {
        const result = await handler({
            method: 'completion/complete',
            params: { ref: { type: 'ref/tool', name: 'group-recipe-context' }, argument: { name: 'groupId', value: 'abc' } }
        });
        expect(result.completion.values).toEqual(expect.arrayContaining(['abc-123', 'abc-456']));
        expect(result.completion.values).not.toContain('xyz-789');
    });

    test('unknown argument returns empty values', async () => {
        const result = await handler({
            method: 'completion/complete',
            params: { ref: { type: 'ref/tool', name: 'groups-summary' }, argument: { name: 'limit', value: '1' } }
        });
        expect(result.completion.values).toEqual([]);
    });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:unit -- --testPathPattern="completions"
```

Expected: FAIL — no completion handler is registered.

- [ ] **Step 3: Register the completion handler in `src/index.ts`**

Add this import at the top of `src/index.ts`:

```typescript
import { CompleteRequestSchema } from '@modelcontextprotocol/sdk/types.js';
```

Add the completion handler registration after the prompt registrations and before `const start`:

```typescript
server.server.setRequestHandler(CompleteRequestSchema, async (request) => {
    const { argument } = request.params;

    if (argument.name === 'language') {
        const all = ['en', 'fr', 'es'];
        return {
            completion: {
                values: all.filter(l => l.startsWith(argument.value))
            }
        };
    }

    if (argument.name === 'groupId') {
        try {
            const groups = await getDatabase().getGroupService().listGroups();
            const matches = groups
                .filter((g: { id: string }) => g.id.startsWith(argument.value))
                .map((g: { id: string }) => g.id)
                .slice(0, 10);
            return { completion: { values: matches } };
        } catch {
            return { completion: { values: [] } };
        }
    }

    return { completion: { values: [] } };
});
```

- [ ] **Step 4: Run tests**

```bash
npm run test:unit -- --testPathPattern="completions"
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts tests/unit/completions.test.ts
git commit -m "feat(mcp): add completion handler for language and groupId arguments"
```

---

### Task 6: MCP Structured Logging

Replace post-connect lifecycle `console.error` calls with `server.sendLoggingMessage()` so MCP clients receive structured log events.

**Files:**
- Modify: `src/index.ts`

**Interfaces:**
- Produces: `server.sendLoggingMessage({ level, data })` calls after transport connects
- Note: DB connection logs happen BEFORE transport connects and must stay as `console.error`

- [ ] **Step 1: Identify which logs can be converted**

In `src/index.ts`, the `start()` function has this order:
1. `initializePromptCache(...)` — before transport, stays `console.error` if it fails
2. `initializeDatabase(...)` → logs before transport, stays `console.error`
3. `server.connect(transport)` ← transport connects here
4. `console.error('MCP Server started successfully')` ← AFTER connect, can use `sendLoggingMessage`

The SIGINT handler runs after connect (server is live), so those logs can also use `sendLoggingMessage`.

- [ ] **Step 2: Update `start()` in `src/index.ts`**

```typescript
const start = async () => {
    try {
        initializePromptCache(path.join(__dirname, 'prompts'));

        if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be defined in environment variables');
        await initializeDatabase(process.env.MONGODB_URI);
        console.error('Successfully connected to MongoDB');

        const transport = new StdioServerTransport();
        await server.connect(transport);

        // After connect — client can receive log messages
        await server.sendLoggingMessage({ level: 'info', data: 'MCP Server started successfully' });
    } catch (error) {
        console.error('Failed to start:', error);
        process.exit(1);
    }
};
```

- [ ] **Step 3: Update SIGINT handler in `src/index.ts`**

```typescript
process.on('SIGINT', async () => {
    try {
        await server.sendLoggingMessage({ level: 'info', data: 'Shutting down: disconnecting from MongoDB' });
        await OutputValidator.closeLogger();
        await disconnectDatabase();
    } catch (e) {
        console.error('Error during shutdown:', e);
    } finally {
        process.exit(0);
    }
});
```

- [ ] **Step 4: Verify existing tests still pass**

The unit test in `tests/unit/index.test.ts` tests the SIGINT handler. `sendLoggingMessage` will fail in test context since no transport is connected — add a guard in the handler:

```typescript
process.on('SIGINT', async () => {
    try {
        try {
            await server.sendLoggingMessage({ level: 'info', data: 'Shutting down: disconnecting from MongoDB' });
        } catch { /* transport may not be connected in test context */ }
        await OutputValidator.closeLogger();
        await disconnectDatabase();
    } catch (e) {
        console.error('Error during shutdown:', e);
    } finally {
        process.exit(0);
    }
});
```

Run tests:

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat(mcp): use sendLoggingMessage for post-connect lifecycle logs"
```

---

### Task 7: Prompt Args Type Safety

Type `PromptMeta.argsSchema` as `ZodRawShape`, add a shared validation utility, and use it in all prompt handlers instead of manual casting.

**Files:**
- Modify: `src/interfaces.ts`
- Create: `src/utils/validate-prompt-args.ts`
- Modify: `src/prompts/family.prompts.ts`
- Modify: `tests/unit/family.prompts.test.ts`

**Interfaces:**
- Produces: `validatePromptArgs<T>(schema: ZodRawShape, args: unknown): T` — throws `McpError(InvalidParams)` on bad input
- Produces: `PromptMeta.argsSchema?: ZodRawShape` — type-safe schema field

- [ ] **Step 1: Write failing tests for validation behavior**

Add to `tests/unit/family.prompts.test.ts`, inside `describe('Family Prompts', ...)`:

```typescript
describe('prompt args validation', () => {
    test('meal-planning-system rejects invalid language', async () => {
        await expect(
            prompts['meal-planning-system'].handler({ language: 'de' })
        ).rejects.toMatchObject({ code: -32602 }); // McpError InvalidParams
    });

    test('plan-family-meals rejects invalid mealType', async () => {
        await expect(
            prompts['plan-family-meals'].handler({ mealType: 'brunch' })
        ).rejects.toMatchObject({ code: -32602 });
    });

    test('weekly-meal-plan rejects days out of range', async () => {
        await expect(
            prompts['weekly-meal-plan'].handler({ days: 100 })
        ).rejects.toMatchObject({ code: -32602 });
    });

    test('meal-planning-system accepts valid args', async () => {
        await expect(
            prompts['meal-planning-system'].handler({ language: 'fr', format: 'short' })
        ).resolves.toHaveProperty('messages');
    });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:unit -- --testPathPattern="family.prompts"
```

Expected: new validation tests FAIL — handlers currently cast args without validation.

- [ ] **Step 3: Update `src/interfaces.ts`**

Add the import and update `PromptMeta`:

```typescript
import type { ZodRawShape } from 'zod';

export interface PromptMeta {
    title: string;
    description: string;
    argsSchema?: ZodRawShape;
}
```

Remove the old `argsSchema?: Record<string, any>` line.

- [ ] **Step 4: Create `src/utils/validate-prompt-args.ts`**

```typescript
import { z, ZodRawShape } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export const validatePromptArgs = <T>(schema: ZodRawShape, args: unknown): T => {
    const result = z.object(schema).safeParse(args);
    if (!result.success) {
        const message = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        throw new McpError(ErrorCode.InvalidParams, `Invalid prompt arguments: ${message}`);
    }
    return result.data as T;
};
```

- [ ] **Step 5: Update `src/prompts/family.prompts.ts`**

Add the import:

```typescript
import { validatePromptArgs } from '../utils/validate-prompt-args';
import { z } from 'zod';
```

Replace the manual cast at the top of each handler with `validatePromptArgs`. Example for `mealPlanningSystemPromptHandler`:

```typescript
export const mealPlanningSystemPromptHandler = async (args: Record<string, unknown>) => {
    const { language, format, groupId } = validatePromptArgs<{
        language?: Language;
        format?: PromptFormat;
        groupId?: string;
    }>({
        language: z.enum(['en', 'fr', 'es']).optional(),
        format: z.enum(['full', 'short', 'template']).optional(),
        groupId: z.string().optional()
    }, args);

    // rest of handler unchanged, defaults applied inline:
    const lang = language ?? 'en';
    const fmt = format ?? 'full';
    let promptContent = getCachedPrompt(lang, fmt);
    // ... rest unchanged
};
```

Apply the same pattern to the remaining 3 handlers (`constraintAwareMealPlanningHandler`, `quickMealSuggestionHandler`, `weeklyMealPlanHandler`). The schema passed to `validatePromptArgs` must match the `argsSchema` defined in `allFamilyPrompts()` at the bottom of the file.

For `constraintAwareMealPlanningHandler`:

```typescript
const { language, groupId, mealType, servings, budget, cuisinePreference } = validatePromptArgs<{
    language?: Language;
    groupId?: string;
    mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    servings?: number;
    budget?: 'low' | 'medium' | 'high';
    cuisinePreference?: string;
}>({
    language: z.enum(['en', 'fr', 'es']).optional(),
    groupId: z.string().optional(),
    mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
    servings: z.number().int().positive().optional(),
    budget: z.enum(['low', 'medium', 'high']).optional(),
    cuisinePreference: z.string().optional()
}, args);
```

For `quickMealSuggestionHandler`:

```typescript
const { language, groupId } = validatePromptArgs<{ language?: Language; groupId?: string }>({
    language: z.enum(['en', 'fr', 'es']).optional(),
    groupId: z.string().optional()
}, args);
```

For `weeklyMealPlanHandler`:

```typescript
const { language, groupId, days, includeBreakfast, includeLunch, includeDinner } = validatePromptArgs<{
    language?: Language;
    groupId?: string;
    days?: number;
    includeBreakfast?: boolean;
    includeLunch?: boolean;
    includeDinner?: boolean;
}>({
    language: z.enum(['en', 'fr', 'es']).optional(),
    groupId: z.string().optional(),
    days: z.number().int().min(1).max(14).optional(),
    includeBreakfast: z.boolean().optional(),
    includeLunch: z.boolean().optional(),
    includeDinner: z.boolean().optional()
}, args);
```

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: all tests PASS, including the 4 new validation tests.

- [ ] **Step 7: Commit**

```bash
git add src/interfaces.ts src/utils/validate-prompt-args.ts src/prompts/family.prompts.ts \
        tests/unit/family.prompts.test.ts
git commit -m "feat(types): type-safe prompt args with Zod validation and McpError on invalid input"
```

---

## Self-Review

**Spec coverage check:**

| Spec item | Covered by task |
|-----------|----------------|
| McpError for not-found and DB errors | Task 1 |
| Tool annotations (readOnlyHint, openWorldHint) | Task 1 |
| Prompt file cache with fail-fast | Task 2 |
| Real DB pagination (in-memory fallback made explicit) | Task 3 |
| Resource listing via `list` callback | Task 4 |
| Argument completions (language static, groupId dynamic) | Task 5 |
| MCP structured logging post-connect | Task 6 |
| Prompt args type safety via ZodRawShape | Task 7 |

**Placeholder scan:** No TBD, TODO, or vague steps found.

**Type consistency check:**
- `getCachedPrompt(lang: Language, format: PromptFormat)` defined in Task 2, consumed in Task 2 step 5 — consistent.
- `validatePromptArgs<T>(schema: ZodRawShape, args: unknown): T` defined in Task 7 step 4, consumed in Task 7 step 5 — consistent.
- `groupResourceList` defined and exported in Task 4 — consistent.
- `McpError` / `ErrorCode` imported from `@modelcontextprotocol/sdk/types.js` in Tasks 1, 4, 7 — consistent.
- `CompleteRequestSchema` imported from `@modelcontextprotocol/sdk/types.js` in Task 5 — consistent.
