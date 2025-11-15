# Claude Desktop Setup - Family Serve Delicious MCP Server

This guide explains how to integrate the Family Serve Delicious MCP Server with Claude Desktop.

## 🚀 Quick Setup

### Step 1: Install Claude Desktop

Download and install Claude Desktop from:
- **Official Website**: https://claude.ai/claude-desktop
- **Available for**: Windows, macOS, and Linux

### Step 2: Generate Configuration

```bash
# Generate Claude Desktop configuration (recommended)
./manage.sh claude config
```

This creates `config/claude_desktop_mcp_config.json` with the correct absolute paths and settings for your project.

**💡 Important**: Replace paths in examples below with your actual project path, or use the generated configuration file for accuracy.

### Step 3: Configure Claude Desktop

#### Locate Claude Desktop config file:

- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

#### Option A: Copy entire configuration
If the file doesn't exist or is empty, copy the entire content from `config/claude_desktop_mcp_config.json`.

#### Option B: Merge with existing configuration
If you already have other MCP servers configured, add the `family-serve-delicious` entry to your existing `mcpServers` section:

**Without authentication (not recommended):**
```json
{
  "mcpServers": {
    "family-serve-delicious": {
      "command": "node",
      "args": ["/absolute/path/to/your/project/dist/index.js"],
      "env": {
        "MONGODB_URI": "mongodb://localhost:27017/family_serve",
        "NODE_ENV": "production",
        "OUTPUT_VALIDATION_MODE": "warn",
        "OUTPUT_VALIDATION_MAX_LENGTH": "50000",
        "OUTPUT_VALIDATION_LOG_PATH": "logs/output-validation.log"
      }
    }
  }
}
```

**With authentication (recommended):**
```json
{
  "mcpServers": {
    "family-serve-delicious": {
      "command": "node",
      "args": ["/absolute/path/to/your/project/dist/index.js"],
      "env": {
        "MONGODB_URI": "mongodb://your_username:your_password@localhost:27017/family_serve?authSource=admin",
        "NODE_ENV": "production",
        "OUTPUT_VALIDATION_MODE": "warn",
        "OUTPUT_VALIDATION_MAX_LENGTH": "50000",
        "OUTPUT_VALIDATION_LOG_PATH": "logs/output-validation.log"
      }
    }
  }
}
```

### Step 4: Start Required Services

```bash
# Start MongoDB
npm run db:start

# Optional: Start MongoDB GUI for monitoring
npm run db:gui
```

### Step 5: Restart Claude Desktop

Completely close and restart Claude Desktop to load the new MCP server configuration.

## 🧪 Testing the Integration

1. **Open Claude Desktop**
2. **Start a new conversation**
3. **Test MCP tools availability**:

Try asking Claude:
> "Can you show me the available family groups in the database?"

or

> "What MCP tools do you have access to for managing family dietary profiles?"

## 🛠️ Available MCP Tools

Once configured, Claude Desktop will have access to these tools:

- **find-group-by-name** - Find a specific family group
- **groups-summary** - List all family groups
- **group-recipe-context** - Get aggregated dietary context for recipes
- **find-members-by-restriction** - Find family members with specific dietary restrictions

## 🔧 Troubleshooting

### Claude Desktop doesn't see the server

1. **Check configuration file location** - Make sure you edited the correct file
2. **Verify JSON syntax** - Use a JSON validator to check your config
3. **Check file paths** - Ensure the path to `dist/index.js` is absolute and correct
4. **Restart completely** - Close Claude Desktop fully before reopening

### Server connection fails

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Start MongoDB**:
   ```bash
   npm run db:start
   ```

3. **Check MongoDB is running**:
   ```bash
   npm run status
   ```

### Testing connectivity

Run a quick test to verify the MCP server works:
```bash
npm run test
```

## 🎯 Usage Examples

Once configured, you can ask Claude to:

1. **Analyze family dietary restrictions**:
   > "Show me all family members who have nut allergies"

2. **Generate recipe suggestions**:
   > "Get the dietary context for the Martin family to help generate appropriate recipes"

3. **Manage family groups**:
   > "List all the family groups in the system"

4. **Find specific dietary needs**:
   > "Find all family members who avoid gluten"

## 📚 Additional Resources

- **LM Studio Setup**: See `docs/LM_STUDIO_SETUP.md` for LM Studio integration
- **MCP Documentation**: https://modelcontextprotocol.io/
- **Claude Desktop Help**: https://claude.ai/help

## 🚨 Important Notes

- **MongoDB must be running** before using Claude Desktop with this server
- **Build the application** (`npm run build`) after any code changes
- **Absolute paths required** in the configuration file
- **Restart Claude Desktop** after configuration changes