<div align="center">

# 🥗🤖 Family Serve Delicious MCP Server

**Model Context Protocol (MCP) server powering AI-driven, constraint‑aware meal planning for families & groups.**

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](#)
[![MCP](https://img.shields.io/badge/protocol-MCP-blue.svg)](#)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

</div>

`family-serve-delicious` provides a specialized bridge between an LLM and structured nutritional / preference data. It fetches groups, applies constraints (allergies, restrictions, health goals) and exposes normalized MCP resources + tools so the model can reason safely and generate reliable recommendations.

> Data layer: [`@axyor/family-serve-database`](https://github.com/Axyor/family-serve-database) (services, validation, domain entities).

## ✨ Core Capabilities

- 🍽️ Multi‑profile contextual meal recommendations
- 🛡️ Strict enforcement of allergies, restrictions, dislikes
- 📦 Structured data model (Group / MemberProfile)
- 🧠 Lightweight RAG: targeted group context injection into the LLM
- 🛠️ Declarative MCP tools (function calling ready)
- 🔍 Group name lookup (avoid loading everything)

## 🧩 MCP Architecture

1. Structured source (MongoDB via the database package)
2. MCP Resource `group`: serializes a specific group
3. Exposed read‑only tools:
	- `find-group-by-name` (fast ID resolution)
	- `group-full` (single group with members)
	- `groups-summary` (paginated lightweight list, no members)
	- `groups-full` (paginated list; optional members via flag)
	- `find-members-by-restriction` (targeted filtering)
4. System prompt (not included here) guides: role, safety, tool usage
5. LLM answers = combination of injected context + tool results

## 🗂️ Resources & Tools

| Type | Name | Description | Load | Recommended Use |
|------|------|-------------|------|------------------|
| Resource | `group` | Full group details (JSON) | Medium (members count) | Deep reasoning phase |
| Tool | `find-group-by-name` | Resolve a name → ID | Very low | First step before context load |
| Tool | `groups-summary` | List groups (no members) | Low | Exploration / selection |
| Tool | `groups-full` | List groups (optional full members) | Medium→High (with members) | Batch comparison; prefer summary + selective drilldown |
| Tool | `group-full` | Fetch single full group by ID | Medium | Focused reasoning after selection |
| Tool | `find-members-by-restriction` | Filtered subset of one group | Low → Medium | Constraint-focused reasoning |

Suggested LLM strategy:
1. Discovery: call `groups-summary` (or `find-group-by-name` if name known).
2. Selection: choose target group IDs.
3. Drilldown: call `group-full` for a single group OR `groups-full` with `includeMembers=false` for multi-group metadata.
4. Deep detail: if absolutely required across many groups, call `groups-full` with `includeMembers=true` (avoid unless narrow slice).
5. Targeted refinement: use `find-members-by-restriction` to pull only constrained subsets.

This minimizes token usage and keeps reasoning focused.

## 🚀 Quick Start

```bash
git clone https://github.com/Axyor/family-serve-delicious
cd family-serve-delicious
npm install
cp .env.example .env   # ajouter MONGODB_URI
npm run build
npm start
```

Required env vars:

| Name | Description |
|------|-------------|
| `MONGODB_URI` | MongoDB connection string |

Dev watch mode: `npm run dev` (incremental TypeScript build).

## 🧪 Tests

```bash
npm test          # jest (unit + integration)
```

Tests mock the DB package to avoid a real Mongo instance (unless you add e2e suites).

## 🔌 LLM Integration (MCP)

The server starts an MCP stdio transport. A client (editor / orchestrator / agent) can:

1. List resources & tools
2. Resolve a groupId via `find-group-by-name`
3. Load resource `group://{groupId}`
4. Call filtering tools for targeted analysis

Returned formats:
- Every tool now wraps data with `type` and `schemaVersion` fields (e.g. `{ "type": "groups-summary", "schemaVersion": 1, ... }`).
- `groups-full` accepts `includeMembers` (default false) to control payload size.
- Empty / null fields pruned server-side to reduce tokens.
- Pagination: `limit` (<=100) & `offset` for `groups-summary` / `groups-full`.

Example minimal `groups-summary` response (pretty-printed for docs):
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

Example `group-full` response (truncated members):
```json
{
	"type": "group-full",
	"schemaVersion": 1,
	"data": {
		"id": "g1",
		"name": "Alpha",
		"membersCount": 2,
		"members": [ { "id": "m-1", "firstName": "F1", "metrics": { "weightKg": 71 } } ]
	}
}
```


## 🤝 Contributing

PRs welcome. Style: strict TypeScript, clear naming, add/update tests before sensitive refactors.

## 📜 License

Distributed under **AGPL-3.0-or-later**. See `LICENSE`.

Private server use allowed; modified network service redistribution must publish corresponding source (network copyleft).

---

Let me know if you’d like a system prompt draft or mutation tools scaffold.