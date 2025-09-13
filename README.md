<div align="center">

# 🥗🤖 Family Serve Delicious MCP Server

**Model Context Protocol (MCP) server powering AI‑driven, constraint‑aware meal planning for families & groups.**

[![MCP](https://img.shields.io/badge/protocol-MCP-blue.svg)](https://modelcontextprotocol.io/docs/getting-started/intro)
[![context prompt-optimized](https://img.shields.io/badge/context-prompt--optimized-blue.svg)](#)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

</div>

`family-serve-delicious` bridges an LLM with structured nutritional & preference data. It fetches groups, applies constraints (allergies, restrictions, health goals) and exposes normalized MCP resources + tools so the model can reason safely and generate reliable recommendations.

> Data layer: [`@axyor/family-serve-database`](https://github.com/username/family-serve-database) (services, validation, domain entities).

---

## 📑 Table of Contents

1. [Core Capabilities](#core-capabilities)
2. [MCP Architecture](#mcp-architecture)
3. [Resources & Tools](#resources-and-tools)
4. [LLM Integration Workflow](#llm-integration-workflow)
5. [Privacy & Anonymization](#privacy-and-anonymization)
6. [Quick Start](#quick-start)
7. [Development Scripts](#development-scripts)
8. [AI Client Integration](#ai-client-integration)
9. [Configuration](#configuration)
   - [Environment Variables](#environment-variables)
   - [GitHub Token Setup](#github-token-setup)
   - [Allergen Synonyms](#allergen-synonyms-configuration)
   - [Preference Patterns](#preference-pattern-configuration)
10. [Docker Architecture](#docker-architecture)
11. [Module System & Database Package](#module-system-and-database-package)
12. [Testing](#tests)
13. [License](#license)

---

<a id="core-capabilities"></a>
## ✨ Core Capabilities

- 🍽️ Multi‑profile contextual meal recommendations
- 🛡️ Strict enforcement of allergies, restrictions, dislikes
- 📦 Structured data model (Group / MemberProfile)
- 🧠 Lightweight RAG: targeted group context injection into the LLM
- 🛠️ Declarative MCP tools (function calling ready)
- 🔍 Group name lookup (avoid loading everything)
- 🐳 Full Docker containerization with MongoDB
- 🤖 Native Claude Desktop and LM Studio integration

<a id="mcp-architecture"></a>
## 🧩 MCP Architecture

1. Structured source (MongoDB via the database package)
2. MCP Resource `group`: serializes a specific group
3. Exposed read‑only tools:
   - `find-group-by-name` (fast ID resolution)
   - `groups-summary` (paginated lightweight list, no members)
   - `group-recipe-context` (aggregated anonymized context for recipe generation)
   - `find-members-by-restriction` (targeted filtering)
4. System prompt (not included here) guides: role, safety, tool usage
5. LLM answers = combination of injected context + tool results

<a id="resources-and-tools"></a>
## 🗂️ Resources & Tools

| Type | Name | Description | Load | Recommended Use |
|------|------|-------------|------|------------------|
| Resource | `group` | Full group details (JSON) | Medium (members count) | Deep reasoning phase |
| Tool | `find-group-by-name` | Resolve a name → ID | Very low | First step before context load |
| Tool | `groups-summary` | List groups (no members) | Low | Exploration / selection |
| Tool | `group-recipe-context` | Aggregated anonymized recipe context | Low→Medium | Direct prompt injection |
| Tool | `find-members-by-restriction` | Filtered subset of one group | Low → Medium | Constraint-focused reasoning |

<a id="llm-integration-workflow"></a>
## 🔌 LLM Integration Workflow

Suggested strategy:
1. Resolve group (via `find-group-by-name` or browse `groups-summary`).
2. Fetch `group-recipe-context` for anonymized aggregated constraints.
3. (Optional) Use `find-members-by-restriction` for focused constraint clarification.

This minimizes token usage and keeps reasoning focused.

Returned formats:
- Every tool wraps data with `type` and `schemaVersion` fields (e.g. `{ "type": "groups-summary", "schemaVersion": 1, ... }`).
- Empty / null fields pruned server-side to reduce tokens.
- Pagination: `limit` (≤100) & `offset` for `groups-summary`.

Example minimal `groups-summary` response:
```json
{
	"type": "groups-summary",
	"schemaVersion": 1,
	"total": 3,
	"limit": 20,
	"offset": 0,
	"count": 3,
	"groups": [
		{ "id": "g1", "name": "Alpha", "membersCount": 2 },
		{ "id": "g2", "name": "Beta",  "membersCount": 1 },
		{ "id": "g3", "name": "Gamma", "membersCount": 0 }
	]
}
```

Example `group-recipe-context` response (simplified):
```json
{
	"type": "group-recipe-context",
	"schemaVersion": 1,
	"group": { "id": "g1", "name": "Alpha", "size": 2 },
	"members": [ { "id": "m-1", "alias": "M1", "ageGroup": "adult" } ],
	"segments": { "ageGroups": { "adult": 2 } },
	"allergies": [],
	"hardRestrictions": [],
	"stats": { "cookingSkillSpread": {} },
	"hash": "sha256:abcd1234ef567890"
}
```

<a id="privacy-and-anonymization"></a>
## 🔒 Privacy & Anonymization

`group-recipe-context` is designed to minimize personal data while preserving 100% of the nutritional / constraint signal required for high‑quality meal planning.

Principles:

- Data minimization: no full names or extraneous attributes needed for reasoning about nutrition, restrictions, allergies, variety.
- Light pseudonymization: optional `alias` (e.g. `M1`, `M2`). The client may generate or omit it; the tool never emits sensitive name fields.
- Aggregation first: segmentation (`segments.ageGroups`), per‑substance allergy counts, sorted restriction lists—patterns over identities.
- Layer separation:
  - Resource `group` = full raw structure (only fetch when explicitly necessary, e.g. for personalized messaging).
  - Tool `group-recipe-context` = compact anonymized view for the common reasoning loop (prompt injection, constraint synthesis, filtering).
- Content hash: `hash` (prefix `sha256:` + 16 hex chars) computed on the anonymized payload → enables client caching, change detection, prompt deduplication, lightweight provenance.
- Harder trivial re‑identification: no per‑member explicit allergy / restriction expansions; only reduced member list (id / alias / ageGroup / skill if present) + aggregates.

Recommended agent / orchestrator flow:
1. Resolve target group (`find-group-by-name` or browse `groups-summary`).
2. Fetch `group-recipe-context`; compare `hash` with cached value.
3. If unchanged → skip re‑injection (token savings). If changed → update internal prompt context / memory.
4. Fetch full `group` resource only when truly needing personal display fields.

Summary: anonymization preserves all constraint & planning utility while intentionally reducing unnecessary personalization.

<a id="quick-start"></a>
## 🚀 Quick Start

### 🔑 GitHub Token Configuration (Required)

This project uses a private npm package `@username/family-serve-database`. Configure your GitHub Personal Access Token first:

```bash
./manage.sh setup
```

### ⚡ Instant Development

```bash
git clone <repository-url>
cd your-project-name
nvm use || echo "(Optional) Use Node 22 LTS: nvm install 22"
npm install
./manage.sh setup  # Configure GitHub token + build
npm run dev        # Start development environment
```

This starts everything you need:
- MongoDB database
- Mongo Express GUI (http://localhost:8081)
- Family Serve MCP Server in development mode

<a id="development-scripts"></a>
## 🛠️ Development Scripts

The project follows standard Node.js conventions for everyday operations:

### 🚀 Development Scripts
```bash
npm run dev              # Start development environment (Docker)
npm run build            # Build TypeScript application
npm run test             # Run all tests
npm run start            # Start built application locally
```

### 🐳 Docker Operations
```bash
npm run prod             # Start production environment
npm run stop             # Stop all Docker services
npm run status           # Show container status
npm run logs             # Show all container logs
npm run logs:app         # Show application logs only
npm run clean            # Clean all containers and volumes
```

### 🗄️ Database Operations
```bash
npm run db:start         # Start MongoDB only
npm run db:stop          # Stop MongoDB only
npm run db:gui           # Start MongoDB web interface
```

### ⚙️ Configuration
```bash
npm run lm-studio        # Generate LM Studio config
```

### 🛠️ Essential Management

For complex operations, use the simplified `manage.sh`:

```bash
./manage.sh setup          # Complete project initialization
./manage.sh lmstudio config # Generate LM Studio configuration
./manage.sh lmstudio help   # Open LM Studio setup guide
./manage.sh claude config   # Generate Claude Desktop configuration
./manage.sh claude help     # Show Claude Desktop setup guide
./manage.sh reset           # Complete system reset (destructive)
```

<a id="ai-client-integration"></a>
## 🤖 AI Client Integration

### Claude Desktop Integration

For Claude Desktop users, the server provides native MCP integration:

1. **Generate Configuration**
   ```bash
   ./manage.sh claude config
   ```

2. **Start MongoDB (Required)**
   ```bash
   npm run db:start
   ```

3. **Configure Claude Desktop**
   - Copy the generated configuration from `config/claude_desktop_mcp_config.json`
   - Add it to your Claude Desktop configuration file
   - Restart Claude Desktop to load the server

For detailed setup instructions and troubleshooting:
```bash
./manage.sh claude help
```

### LM Studio Integration

For LM Studio users, the server supports native MCP protocol:

1. **Generate Configuration**
   ```bash
   ./manage.sh lmstudio config
   ```

2. **Start MongoDB (Required)**
   ```bash
   npm run db:start
   ```

3. **Add Server to LM Studio**
   - Open LM Studio → My Projects
   - Add the generated configuration from `config/lm_studio_mcp_config.json`
   - The server will be available for chat interactions

For detailed setup instructions:
```bash
./manage.sh lmstudio help
```

<a id="configuration"></a>
## ⚙️ Configuration

<a id="environment-variables"></a>
### Environment Variables

| Name | Description |
|------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `NODE_ENV` | Environment (development/production) |

<a id="github-token-setup"></a>
### GitHub Token Setup

For private package access, configure your GitHub Personal Access Token:

1. **Generate Token**
   - Go to GitHub → Settings → Developer settings → Personal access tokens
   - Generate new token with `packages:read` scope

2. **Configure npm**
   ```bash
   ./manage.sh setup
   ```
   This will prompt for your GitHub username and token.

<a id="allergen-synonyms-configuration"></a>
### Allergen Synonyms Configuration

The server loads a JSON mapping: `config/allergen-synonyms.json` to enable multilingual allergy aggregation.

Format:
```json
{
	"peanut": ["peanut", "peanuts", "arachide", "arachides"],
	"dairy": ["dairy", "milk", "lait"]
}
```
- Key = canonical form (appears in the payload).
- Values = synonyms (case‑insensitive, whitespace normalized).
- Any allergen not present falls back to its cleaned (lowercased) form.

Loading:
- Lazy loaded on the first `group-recipe-context` call.
- Reverse index built (synonym → canonical) for O(1) lookup.

Updating:
1. Edit the JSON file.
2. Restart the server (no dynamic reload yet).

Best practices:
- Include both local language and English variants.
- Keep accents; they are lowercased but not stripped (adjust later if needed).
- Avoid exact duplicates.

Current limitations:
- No severity weighting (future shape could be: `{ "peanut": { "synonyms": [...], "severity": "high" }}` ).
- No region scoping.

Failure fallback: if the file can't be read, aggregation degrades to plain lowercase grouping (no synonym fusion).

<a id="preference-pattern-configuration"></a>
### Preference Pattern Configuration

Negative / exclusion culinary preferences use `config/preference-patterns.json`.

Structure:
```jsonc
{
	"dislikeIndicators": ["dislike", "déteste", "odio"],
	"avoidIndicators": ["avoid", "éviter", "vermeide"],
	"excludeIndicators": ["no", "sans", "without", "sin"],
	"splitDelimitersRegex": ",|;|/|\\\\| et | and | y | ou "
}
```

How it works:
- Preference string lower‑cased.
- Detect leading indicator (longest first).
- Remainder split by `splitDelimitersRegex`.
- Tokens trimmed → stored as dislikes (soft signals).

Why external config:
- Expand to new languages without code changes.
- Adjust token splitting for edge cases.
- Enable experimentation with detection scope.

Updating:
1. Edit the JSON file.
2. Restart the server (no hot reload yet).

Best practices:
- Keep indicators singular (avoid duplicates like "avoid" and "avoid ").
- Add longer, more specific phrases first (auto length sorting ensures precedence).
- Include common conjunctions in `splitDelimitersRegex` for supported languages.

<a id="docker-architecture"></a>
## 🐳 Docker Architecture

The project uses **two docker-compose configurations**:

### Production (`docker-compose.yml`)
- **MongoDB**: Database server with persistent storage
- **Mongo Express**: Web-based MongoDB GUI  
- **Family Serve App**: Containerized MCP server (built from Dockerfile)

### Development (`docker-compose.dev.yml`)
- **MongoDB**: Database server with separate dev volumes
- **Mongo Express**: Web-based MongoDB GUI
- **Family Serve App**: Development container with hot-reload (built from Dockerfile.dev)

### Direct Docker Compose Usage

```bash
# Production
docker-compose up -d
docker-compose ps
docker-compose logs -f
docker-compose down

# Development
docker-compose -f docker-compose.dev.yml up -d
docker-compose -f docker-compose.dev.yml logs -f family-serve-app
docker-compose -f docker-compose.dev.yml down
```

**Recommended**: Use npm scripts instead for consistency:
```bash
npm run prod     # Production environment
npm run dev      # Development environment  
npm run stop     # Stop all services
npm run status   # View service status
```

**Runtime:**
- Node.js 22.x (LTS) – see `.nvmrc`.
- TypeScript target: ES2023.

**Dev watch mode**: `npm run dev` (incremental build with Docker hot-reload).

<a id="module-system-and-database-package"></a>
## 🧱 Module System & Database Package

The server runs as CommonJS targeting Node 22 LTS while `@username/family-serve-database` ships as a dual package (conditional exports for both `require` and `import`).

Implications:
- Plain `import { Database } ...` in TypeScript compiles to `require`.
- Tooling (Jest, ts-jest) works without experimental ESM flags.
- ESM consumers still interoperate seamlessly.

Upgrade checklist (if coming from older ESM‑only DB version):
1. Upgrade `@username/family-serve-database` to >= 2.1.0 (dual exports).
2. Remove any `await import('@username/family-serve-database')` loader code.
3. Ensure test script no longer uses `--experimental-vm-modules`.
4. Rebuild & run tests (should pass unchanged).
5. (Optional) Pin Node 22 in CI using `.nvmrc` or `setup-node` `node-version: '22'`.

Node 22 specifics:
- Native ES2023 features (e.g. `Array.prototype.findLast`).
- Faster startup; no experimental module flags.
- Cleaner TypeScript output targeting ES2023.

<a id="tests"></a>
## 🧪 Tests

```bash
npm test  # jest (unit + integration)
```

Tests mock the DB package to avoid a real Mongo instance (unless you add e2e suites).

<a id="license"></a>
## 📜 License

Distributed under **AGPL-3.0-or-later**. See `LICENSE`.

Private server use allowed; modified network service redistribution must publish corresponding source (network copyleft).