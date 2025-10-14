<div align="center">

# 🥗🤖 Family Serve Delicious MCP Server

**Model Context Protocol (MCP) server powering AI‑driven, constraint‑aware meal planning for families & groups with local LLM models.**

[![MCP](https://img.shields.io/badge/protocol-MCP-blue.svg)](https://modelcontextprotocol.io/docs/getting-started/intro)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

</div>

`family-serve-delicious` bridges local LLM models with structured nutritional & preference data. It fetches groups, applies constraints (allergies, restrictions, health goals) and exposes normalized MCP resources, tools, and prompts so the model can reason safely and generate reliable meal recommendations.

> **Data layer:** [`@axyor/family-serve-database`](https://github.com/Axyor/family-serve-database) - Complete database abstraction with services, validation, and domain entities. Provides TypeScript interfaces, enums, and business logic for family dietary management.

---

## 📑 Table of Contents

1. [Core Capabilities](#core-capabilities)
2. [MCP Architecture](#mcp-architecture)
3. [Resources, Tools & Prompts](#resources-tools-and-prompts)
4. [LLM Integration Workflow](#llm-integration-workflow)
5. [Privacy & Anonymization](#privacy-and-anonymization)
6. [Quick Start](#quick-start)
7. [Development Scripts](#development-scripts)
8. [AI Client Integration](#ai-client-integration)
   - [Claude Desktop](#claude-desktop-integration)
   - [LM Studio](#lm-studio-integration)
9. [Configuration](#configuration)
   - [Environment Variables](#environment-variables)
   - [GitHub Token Setup](#github-token-setup)
   - [Allergen Synonyms](#allergen-synonyms-configuration)
   - [Preference Patterns](#preference-pattern-configuration)
   - [Example Family Data](#example-family-data)
10. [Prompt Selection Strategy](#prompt-selection-strategy)
11. [Module System & Database Package](#module-system-and-database-package)
12. [Testing](#tests)
13. [License](#license)

---

<a id="core-capabilities"></a>
## ✨ Core Capabilities

### 🎯 MCP Primitives
- 📦 **Resources:** Full group data access via URI templates
- 🛠️ **Tools:** 4 specialized tools for group discovery and context retrieval
- 💬 **Prompts:** 4 multilingual prompt templates for common meal planning scenarios

### 🍽️ Meal Planning Features
- 🍽️ Multi‑profile contextual meal recommendations
- 🛡️ Strict enforcement of allergies, restrictions, dislikes
- 🧠 Lightweight RAG: targeted group context injection into the LLM
- 🦊 Smart group lookup (avoid loading unnecessary data)
- 🌍 Multilingual support (English, French, Spanish)

### 💾 Data & Architecture
- 🏘️ Structured data model (Group / MemberProfile)
- 🔐 Privacy-first anonymization and aggregation
- 🐳 Docker-ready with MongoDB persistence
- ⚡ Optimized for local LLMs (token-efficient prompts)

<a id="mcp-architecture"></a>
## 🧩 MCP Architecture

The server implements the complete Model Context Protocol specification:

1. **Data Source:** MongoDB via [`@axyor/family-serve-database`](https://github.com/Axyor/family-serve-database) package
2. **MCP Resource:** `groups://{groupId}` - Full group serialization
3. **MCP Tools (4):**
   - `find-group-by-name` - Fast ID resolution
   - `groups-summary` - Paginated lightweight list
   - `group-recipe-context` - Aggregated anonymized context
   - `find-members-by-restriction` - Targeted filtering
4. **MCP Prompts (4):**
   - `meal-planning-system` - Base system prompt
   - `plan-family-meals` - Constraint-aware meal suggestions
   - `quick-meal-suggestions` - Fast meal ideas
   - `weekly-meal-plan` - Multi-day planning with shopping list
5. **Transport:** stdio (standard input/output) for universal MCP client compatibility
6. **LLM Integration:** Combination of injected context + tool results + prompt templates

**Design Philosophy:**
- 🔐 Privacy-first: Anonymized data by default
- ⚡ Token-optimized: Minimal data transfer
- 🛡️ Safety-focused: Strict constraint enforcement
- 🔄 Cache-friendly: Hash-based context reuse

<a id="resources-tools-and-prompts"></a>
## 🗂️ Resources, Tools & Prompts

The Family Serve Delicious MCP server exposes three types of MCP primitives for AI-powered meal planning:

### 📦 Resources

| Name | URI Pattern | Description | Use Case |
|------|-------------|-------------|----------|
| `group` | `groups://{groupId}` | Full group details with member profiles | When you need names or detailed personal information |

### 🛠️ Tools

| Name | Description | Token Cost | Recommended Use |
|------|-------------|------------|-----------------|
| `find-group-by-name` | Resolve group name → ID | Very low | First step: find target group |
| `groups-summary` | List all groups (no members) | Low | Browse/explore available groups |
| `group-recipe-context` | Aggregated anonymized constraints | Low→Medium | Primary meal planning data source |
| `find-members-by-restriction` | Filter members by dietary restriction | Low→Medium | Targeted constraint investigation |

### 💬 MCP Prompts

Built-in prompt templates for common meal planning scenarios:

| Name | Description | Key Parameters |
|------|-------------|----------------|
| `meal-planning-system` | Base system prompt for meal planning | `language`, `format`, `groupId?` |
| `plan-family-meals` | Generate meal suggestions with constraints | `groupId`, `mealType?`, `servings?`, `budget?` |
| `quick-meal-suggestions` | Get 3-5 quick meal ideas (≤30min) | `groupId`, `language?` |
| `weekly-meal-plan` | Create weekly meal plan + shopping list | `groupId`, `days?`, `includeBreakfast?`, `includeLunch?`, `includeDinner?` |

**Multilingual Support:** All prompts available in English (`en`), French (`fr`), and Spanish (`es`)  
**Client Compatibility:** Works with any MCP client supporting prompts (Claude Desktop, VS Code Copilot, etc.)

**Example Usage:**
```typescript
// Using the weekly-meal-plan prompt
{
  name: "weekly-meal-plan",
  arguments: {
    groupId: "family-alpha",
    days: 7,
    includeBreakfast: true,
    includeLunch: true,
    includeDinner: true,
    language: "fr"
  }
}
```

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

The `group-recipe-context` tool implements **privacy-first design** while preserving 100% of nutritional constraints needed for meal planning.

**Key Features:**
- **Data minimization**: Only essential constraint data (allergies, restrictions, age groups)
- **Pseudonymization**: Members identified as `M1`, `M2`, etc. instead of real names  
- **Aggregation**: Focus on patterns, not individuals (allergy counts, age group distribution)
- **Hash-based caching**: `sha256:` prefix enables efficient context reuse without re-injection

**Two-layer architecture:**
- `groups://{id}` resource: Full personal data (use only for personalization)
- `group-recipe-context` tool: Anonymized constraints (default for meal planning)

**Workflow:**
1. Fetch `group-recipe-context` with generated `hash`
2. Reuse context if `hash` unchanged (token savings)
3. Only fetch full `group` resource when names needed

<a id="quick-start"></a>
## 🚀 Quick Start

### 🔑 GitHub Token Configuration (Required)

This project uses a private npm package `@axyor/family-serve-database`. Configure your GitHub Personal Access Token first:

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
npm run claude           # Generate Claude Desktop config
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

The Family Serve Delicious MCP server integrates seamlessly with popular AI clients:

<a id="claude-desktop-integration"></a>
### 🎯 Claude Desktop Integration

Claude Desktop provides native MCP support with an intuitive interface:

**Quick Setup:**
```bash
# 1. Generate configuration
npm run claude

# 2. Start MongoDB
npm run db:start

# 3. Build the application
npm run build

# 4. Copy generated config to Claude Desktop
# Configuration file: config/claude_desktop_mcp_config.json
```

**Configuration Location:**
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

**Detailed Guide:**
```bash
./manage.sh claude help
```

Or see: [docs/CLAUDE_DESKTOP_SETUP.md](docs/CLAUDE_DESKTOP_SETUP.md)

<a id="lm-studio-integration"></a>
### 🧠 LM Studio Integration

LM Studio offers powerful local LLM capabilities with MCP protocol support:

**Quick Setup:**
```bash
# 1. Generate configuration
npm run lm-studio

# 2. Start MongoDB
npm run db:start

# 3. Build the application
npm run build

# 4. Add server to LM Studio
# Configuration file: config/lm_studio_mcp_config.json
```

**Configuration Location:**
- **Windows:** `%APPDATA%\LMStudio\mcp_servers.json`
- **macOS:** `~/Library/Application Support/LMStudio/mcp_servers.json`
- **Linux:** `~/.config/LMStudio/mcp_servers.json`

**Verify Connection:**
1. Open LM Studio → My Projects
2. Check that "family-serve-delicious" appears in available servers
3. Test with: `"Use the groups-summary tool to show available groups"`

**Detailed Guide:**
```bash
./manage.sh lmstudio help
```

Or see: [docs/LM_STUDIO_SETUP.md](docs/LM_STUDIO_SETUP.md)

### 🔧 Other MCP Clients

The server uses standard **stdio transport** and works with any MCP-compatible client:

- **VS Code Copilot** - Configure via MCP settings
- **Continue.dev** - Add to MCP servers configuration  
- **Custom Clients** - Use the MCP SDK with stdio transport

**Generic Configuration:**
```json
{
  "command": "node",
  "args": ["/absolute/path/to/family-serve-delicious/dist/index.js"],
  "env": {
    "MONGODB_URI": "mongodb://localhost:27017/family_serve",
    "NODE_ENV": "production"
  }
}
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

The server uses `config/allergen-synonyms.json` for **multilingual allergen normalization**.

**Format:**
```json
{
  "peanut": ["peanut", "peanuts", "arachide", "cacahuete"],
  "dairy": ["dairy", "milk", "lait"]
}
```

**Implementation:**
- **Lazy loading**: Built on first `group-recipe-context` call
- **Reverse index**: O(1) lookup (synonym → canonical form)
- **Fallback**: Missing allergens use lowercase form
- **Case-insensitive**: All comparisons normalized

**Usage:** Restart server after editing (no dynamic reload).

<a id="preference-pattern-configuration"></a>
### Preference Pattern Configuration

The server uses `config/preference-patterns.json` for **multilingual negative preference detection**.

**Format:**
```json
{
  "dislikeIndicators": ["déteste", "dislike", "hate"],
  "avoidIndicators": ["éviter", "avoid", "vermeide"],
  "excludeIndicators": ["sans", "without", "sin", "no"],
  "splitDelimitersRegex": ",|;|/| et | and | y | ou "
}
```

**Processing logic:**
1. **Detect indicators**: Longest-first matching (case-insensitive)
2. **Extract tokens**: Split remaining text by regex delimiters
3. **Store as dislikes**: Added to soft preference constraints

**Usage:** Restart server after editing (no dynamic reload).

<a id="exemple-family-data"></a>
### Example Family Data

The project includes a complete example family in `config/family-example-template.json` to help you understand the data structure and test the system:

**Usage:**
```bash
# Load the example data into your database
# (Implementation depends on your database setup scripts)
# The file serves as a perfect template for creating your own families
```

**Customization:** Use this template as a starting point to create your own family profiles with appropriate dietary restrictions, preferences, and cooking skills.

<a id="docker-architecture"></a>
**Runtime Requirements:**
- Node.js 22.x (LTS) – see `.nvmrc`
- TypeScript target: ES2023
- MongoDB for data storage

<a id="local-llm-compatibility"></a>
## 🧠 Local LLM Compatibility

**Key Insight:** Local LLMs with limited context windows need optimized prompts to function effectively.

#### **Prompt Compatibility Matrix**

| LLM Category | Context Window | Recommended Prompt | Examples |
|-------------|----------------|-------------------|----------|
| **Large (≥70B)** | 32K+ tokens | `system-full.md` (1,600 tokens) | GPT-4, Claude 3 |
| **Medium (13-70B)** | 4K-16K tokens | `system.short.md` (190 tokens) | Llama 2 70B, Mixtral 8x7B |
| **Small (7-20B)** | 2K-8K tokens | `system.short.md` (**Essential**) | GPT OSS 20B, Llama 7B-13B |
| **Embedded** | <4K tokens | `system.short.md` (**Critical**) | Edge deployment models |

#### **Tested Models**
- ✅ **GPT OSS 20B** + `system.short.md` → Works well
- ❌ **GPT OSS 20B** + `system-full.md` → Token budget exceeded
- ✅ **Llama 7B-13B** → Requires `system.short.md`
- ✅ **Mixtral 8x7B** → Both prompts work, prefer short for efficiency

<a id="prompt-selection-strategy"></a>
### 📋 Prompt Selection Strategy

The MCP server provides **two system prompt versions** optimized for different LLM capabilities:

| Prompt File | Size | Best For |
|-------------|------|----------|
| `system.short.md` | ~190 tokens | Small LLMs (7B-20B), limited context (≤16K) |
| `system-full.md` | ~1,600 tokens | Large LLMs (≥70B), generous context (≥32K) |

**Quick Selection:**
- **Use `system.short.md`** for most local/smaller LLMs (GPT OSS 20B, Llama 7B-13B)
- **Use `system-full.md`** for large cloud models or 70B+ local models

**Implementation:** Copy the appropriate prompt file content to your MCP client configuration.

```bash
# For small LLMs
cat src/prompts/en/system.short.md

# For large LLMs  
cat src/prompts/en/system-full.md
```


<a id="module-system-and-database-package"></a>
## 🧱 Module System & Database Package

**Architecture:** CommonJS server (Node 22 LTS) + dual-package database module.

**Database Package:** [`@axyor/family-serve-database`](https://github.com/Axyor/family-serve-database) `v2.1.0+`
- TypeScript interfaces & validation schemas
- MongoDB abstraction & business logic services  
- Dual exports (CommonJS/ESM compatible)
- Complete domain models for dietary management

**Configuration:**
- **Target:** ES2023 (Node 22 native features)
- **Module:** Node16 resolution  
- **Import:** Standard `import { Database }` syntax
- **Testing:** Jest with ts-jest (no experimental flags needed)

**Key Features:**
- ✅ Type-safe database operations
- ✅ Validation schemas with Zod
- ✅ Service layer for business logic
- ✅ Domain entities (Group, MemberProfile, etc.)
- ✅ Enums for dietary restrictions, allergens, health goals

<a id="tests"></a>
## 🧪 Testing

The project includes comprehensive test coverage with unit and integration tests:

```bash
npm test                    # Run all tests
npm test -- --watch        # Run tests in watch mode
npm test -- --coverage     # Generate coverage report
```

<a id="license"></a>
## 📜 License

Distributed under **AGPL-3.0-or-later**. See `LICENSE`.

Private server use allowed; modified network service redistribution must publish corresponding source (network copyleft).