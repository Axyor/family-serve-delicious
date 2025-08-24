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
	- `groups-summary` (paginated lightweight list, no members)
	- `group-recipe-context` (aggregated anonymized context for recipe generation)
	- `find-members-by-restriction` (targeted filtering)
4. System prompt (not included here) guides: role, safety, tool usage
5. LLM answers = combination of injected context + tool results

## 🗂️ Resources & Tools

| Type | Name | Description | Load | Recommended Use |
|------|------|-------------|------|------------------|
| Resource | `group` | Full group details (JSON) | Medium (members count) | Deep reasoning phase |
| Tool | `find-group-by-name` | Resolve a name → ID | Very low | First step before context load |
| Tool | `groups-summary` | List groups (no members) | Low | Exploration / selection |
| Tool | `group-recipe-context` | Aggregated anonymized recipe context | Low→Medium | Direct prompt injection |
| Tool | `find-members-by-restriction` | Filtered subset of one group | Low → Medium | Constraint-focused reasoning |

Suggested LLM strategy:
1. Resolve group (via `find-group-by-name` or browse `groups-summary`).
2. Fetch `group-recipe-context` for anonymized aggregated constraints.
3. (Optional) Use `find-members-by-restriction` for focused constraint clarification.

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
3. Load resource `group://{groupId}` if you need raw structure, otherwise jump to `group-recipe-context`
4. Call filtering tools for targeted analysis

Returned formats:
- Every tool now wraps data with `type` and `schemaVersion` fields (e.g. `{ "type": "groups-summary", "schemaVersion": 1, ... }`).
- Empty / null fields pruned server-side to reduce tokens.
- Pagination: `limit` (<=100) & `offset` for `groups-summary`.

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

## 🧾 Allergen Synonyms Configuration

To enable multilingual allergy aggregation without hard‑coding logic, the server loads a JSON mapping: `config/allergen-synonyms.json`.

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
- No severity weighting (future shape could be: { "peanut": { "synonyms": [...], "severity": "high" }} ).
- No region scoping.

Failure fallback: if the file can’t be read, aggregation degrades to plain lowercase grouping (no synonym fusion).

## 🧪 Preference Pattern Configuration

Negative / exclusion culinary preferences are parsed using a multilingual pattern file: `config/preference-patterns.json`.

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
- Each preference string from a member’s dietaryProfile.preferences is lower‑cased.
- The code checks whether it starts with any indicator (longest indicators matched first).
- The remainder of the string is split by `splitDelimitersRegex` into individual tokens.
- Tokens are trimmed and stored as dislikes (soft negative signals).

Why external config:
- Expand to new languages without code changes.
- Adjust token splitting for edge cases (e.g. add locale conjunctions).
- Allow experimentation with detection scope.

Updating:
1. Edit the JSON file.
2. Restart the server (no hot reload yet).

Best practices:
- Keep indicators singular (avoid duplicates like "avoid" and "avoid ").
- Add longer, more specific phrases first (sorting by length is automatic to prefer longest match).
- Include common conjunctions in `splitDelimitersRegex` for the languages you support.

Limitations / Future ideas:
- No sentiment weighting; all extracted tokens treated equally.
- No mapping to standardized dislike taxonomy (future: map to ingredient ontology).
- Only prefix matching; phrases like "I really dislike cilantro" aren’t caught (could add regex mode later).

Fallback: if the file is missing or invalid, extraction silently degrades (only cuisinePreferences remain, dislikes may be empty).



## 🤝 Contributing

PRs welcome. Style: strict TypeScript, clear naming, add/update tests before sensitive refactors.

## 📜 License

Distributed under **AGPL-3.0-or-later**. See `LICENSE`.

Private server use allowed; modified network service redistribution must publish corresponding source (network copyleft).

---

Let me know if you’d like a system prompt draft or mutation tools scaffold.