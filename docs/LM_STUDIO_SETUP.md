# LM Studio Configuration - Family Serve Delicious MCP Server

## 🎯 Overview

This guide explains how to connect the Family Serve Delicious MCP server to LM Studio to use dietary profile management tools directly in your conversations.

## 📋 Prerequisites

1. ✅ MCP server running and functional
2. ✅ LM Studio installed on your system
3. ✅ MongoDB accessible (local or Docker)

## 🚀 Step-by-step Configuration

### Step 1: Verify MCP server is working

```bash
# Check that all services are active
docker-compose ps

# Check logs
docker-compose logs family-serve-app
```

The server should display:
```
✅ Database initialized successfully
Successfully connected to MongoDB
MCP Server started successfully
```

### Step 2: LM Studio configuration files location

LM Studio stores its configurations in:

**Windows:**
```
%APPDATA%\LMStudio\mcp_servers.json
```

**macOS:**
```
~/Library/Application Support/LMStudio/mcp_servers.json
```

**Linux:**
```
~/.config/LMStudio/mcp_servers.json
```

### Step 3: Configure the server

**💡 Important**: Replace `/path/to/your/project` with the actual absolute path to your project directory.

#### Option A: Use the automatic generator (recommended)

```bash
./manage.sh lmstudio config
```

This generates a configuration file with the correct paths automatically and displays the JSON you need to copy to LM Studio.

#### Option B: Manual configuration

Create or edit the `mcp_servers.json` file with your project's absolute path:

```json
{
  "name": "family-serve-delicious",
  "command": "node",
  "args": ["/path/to/your/project/dist/index.js"],
  "env": {
    "MONGODB_URI": "mongodb://localhost:27017/family_serve",
    "NODE_ENV": "production"
  }
}

### Step 4: Restart LM Studio

Completely close LM Studio and relaunch it to load the new configuration.

### Step 5: Connection verification

1. Open a new conversation in LM Studio
2. Verify that the MCP server appears in the list of available tools
3. You should see the tools:
   - `find-group-by-name`
   - `groups-summary`
   - `group-recipe-context`
   - `find-members-by-restriction`

## 🛠️ Configuration helper scripts

### LM Studio configuration generation script

Use this script to automatically generate the configuration:

```bash
./manage.sh lmstudio config
```

Or manually:

```bash
# Generate configuration for your system
node -e "
const config = {
  servers: {
    'family-serve-delicious': {
      command: 'node',
      args: ['$(pwd)/dist/index.js'],
      env: {
        MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/family_serve',
        NODE_ENV: 'production'
      }
    }
  }
};
console.log(JSON.stringify(config, null, 2));
"
```

## 📱 Usage in LM Studio

Once configured, you can use the tools in your conversations:

### Usage examples

**1. List family groups:**
```
Can you show me a summary of available family groups?
```

**2. Search for a specific group:**
```
Find me the group "Martin Family"
```

**3. Search for dietary restrictions:**
```
Which members have nut allergies?
```

**4. Generate adapted recipes:**
```
Generate a dinner recipe suitable for the "Dupont Family" group
```

## 🐛 Troubleshooting

### Issue: Server doesn't appear in LM Studio

**Solution:**
1. Check the path to `dist/index.js`
2. Make sure the MCP server is built: `npm run build`
3. Check LM Studio logs for errors

### Issue: MongoDB connection error

**Solution:**
1. Check that MongoDB is started: `docker-compose ps`
2. Test the connection: `mongosh mongodb://localhost:27017/family_serve`
3. Check the URI in the configuration

### Issue: Tools not available

**Solution:**
1. Check MCP server logs: `docker-compose logs family-serve-app`
2. Completely restart LM Studio
3. Check JSON syntax in configuration

## 🔧 Advanced configuration

### Using with Docker

If you want LM Studio to use the Docker container directly:

```json
{
  "servers": {
    "family-serve-delicious": {
      "command": "docker",
      "args": [
        "exec",
        "family-serve-app",
        "node",
        "/app/dist/index.js"
      ],
      "env": {
        "MONGODB_URI": "mongodb://mongodb:27017/family_serve"
      }
    }
  }
}
```

### Development mode

For development with hot-reload, replace `/path/to/your/project` with your actual project path:

```json
{
  "servers": {
    "family-serve-delicious-dev": {
      "command": "npm",
      "args": ["run", "dev"],
      "cwd": "/path/to/your/project",
      "env": {
        "MONGODB_URI": "mongodb://localhost:27017/family_serve",
        "NODE_ENV": "development"
      }
    }
  }
}
```

**💡 Tip**: Use `./manage.sh lmstudio config` to get the correct paths automatically.

## ✅ Final verification

Once everything is configured, test with this command in LM Studio:

```
Use the groups-summary tool to show me the available groups.
```

You should receive a response with the list of family groups from your database.

## 📚 Additional resources

- [Official MCP Documentation](https://modelcontextprotocol.io/)
- [LM Studio MCP Guide](https://lmstudio.ai/docs/mcp)
- Local configuration: `config/lm_studio_config.json`