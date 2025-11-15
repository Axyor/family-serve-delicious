# Changelog

All notable changes to this project will be documented in this file.

## [2.1.0] - 2025-11-15

### 🔒 Security Enhancements
- **Input Sanitization**: Implementation of comprehensive input sanitization system
  - HTML sanitization for all text inputs to prevent XSS attacks
  - Path traversal prevention for file operations
  - MongoDB injection protection with query validation
  - Command injection prevention
  - New `sanitization.ts` module with extensive validation functions

- **Output Validation**: Robust output validation framework
  - Schema-based validation for all API responses
  - Type checking and data structure validation
  - Safe error message handling to prevent information leakage
  - New `output-validation.ts` module with comprehensive validators

### 🧪 Testing
- **Security Tests**: Complete security test suite
  - Unit tests for sanitization functions
  - Unit tests for output validation
  - Coverage for XSS, path traversal, and injection attacks

### 📝 Documentation
- **Security Documentation**: Comprehensive security documentation
  - `MONGODB_SECURITY.md`: MongoDB security best practices
  - `SANITIZATION_IMPLEMENTATION.md`: Input sanitization guide
  - `OUTPUT_VALIDATION_IMPLEMENTATION.md`: Output validation guide
  - `AUDIT_BONNES_PRATIQUES_MCP.md`: MCP security audit and best practices

### 🔧 Improved
- **Code Quality**: Enhanced security posture across all modules
- **Error Handling**: Safer error messages without sensitive data exposure

## [2.0.0] - 2025-11-09

### 🚀 Major Changes
- **Breaking Change**: Compatibility update for `family-serve-database` v2.2.0
  - Updated to support new database schema and API changes
  - Enhanced allergen normalization system with improved synonym mapping
  - Improved data structure handling in group helpers

### 🔧 Updated
- **Dependencies**: Updated `@axyor/family-serve-database` to v2.2.0
- **Core Logic**: Enhanced `group.helpers.ts` with better allergen processing
  - Improved `AllergenSynonymIndex` class implementation
  - Better handling of allergen canonical names
  - Enhanced data pruning and normalization functions

### 🧪 Testing
- **Integration Tests**: Expanded test coverage for group tools
  - Added more test cases for allergen handling
  - Improved validation of group recipe context generation

### 📝 Configuration
- **Template Updates**: Updated `family-example-template.json` structure
  - Aligned with new database requirements
  - Enhanced example data format

## [1.2.2] - 2025-11-07

### 🔧 Updated
- **Dependencies**: Updated project dependencies
  - Updated `@modelcontextprotocol/sdk` to latest version
  - Updated build scripts and tooling

## [1.2.1] - 2025-10-14

### ✨ Added
- **MCP Prompts System**: Implementation of Model Context Protocol prompts functionality
  - New `family.prompts.ts` module for handling MCP prompts
  - Enhanced integration with MCP server capabilities
  - Comprehensive test coverage for prompts functionality

### 🔧 Improved
- **Code Structure**: Externalized interfaces into dedicated directory
  - Moved group interfaces to centralized `src/interfaces.ts`
  - Better code organization and maintainability
  - Improved TypeScript configuration

### 📝 Documentation
- **README**: Updated documentation to reflect new prompts functionality
  - Enhanced MCP integration documentation
  - Updated architecture diagrams

### 🧪 Testing
- **Integration Tests**: Added comprehensive integration tests for family prompts
- **Unit Tests**: New unit tests for prompts functionality

## [1.1.0] - 2024-09-10

### 🎯 Major: Script Consolidation & Unified Management

#### Added
- **Unified Management Script** (`manage.sh`): Single script to replace all individual shell scripts
  - MongoDB management (start/stop/restart/status/logs)
  - Mongo Express GUI management (start/stop/open)
  - Application lifecycle (build/start/dev)
  - Data management (inject test data)
  - Testing (simple MCP tests)
  - System management (status/cleanup/reset)

#### Enhanced
- **Package.json Scripts**: Updated all npm scripts to use unified management script
  - `npm run start:safe` → `./manage.sh app start`
  - `npm run dev:safe` → `./manage.sh app dev`
  - `npm run mongodb:start` → `./manage.sh mongodb start`
  - `npm run mongodb:gui` → `./manage.sh gui start`
  - `npm run data:inject` → `./manage.sh data inject`
  - Added `npm run status` → `./manage.sh status`
  - Added `npm run cleanup` → `./manage.sh cleanup`
  - Added `npm run reset` → `./manage.sh reset`

#### Improved
- **Error Handling**: Comprehensive error checking and validation
- **Status Reporting**: Color-coded status messages with timestamps
- **Dependency Management**: Automatic MongoDB startup when needed
- **Health Monitoring**: Real-time service health checks
- **User Experience**: Consistent command structure and help system

#### Removed
- **Individual Shell Scripts**: Consolidated functionality into single script
  - `scripts/mongodb.sh` (merged into `manage.sh mongodb`)
  - `scripts/start.sh` (merged into `manage.sh app start`)
  - `scripts/mongo-gui.sh` (merged into `manage.sh gui`)
  - `scripts/dev.sh` (merged into `manage.sh app dev`)

#### Documentation
- **Management Script Guide**: Comprehensive documentation in `docs/MANAGEMENT_SCRIPT.md`
- **Updated README**: Reflects new unified workflow
- **Command Reference**: Complete command documentation with examples

### 🔧 Technical Improvements

#### Script Features
- **Automatic Dependencies**: MongoDB auto-start when needed
- **Build Validation**: Automatic building when required
- **Port Monitoring**: Real-time port accessibility checks
- **Container Management**: Proper Docker container lifecycle
- **Signal Handling**: Graceful shutdown on interrupts

#### Development Workflow
- **Simplified Setup**: Single command workflows for common tasks
- **Development Mode**: Enhanced watch mode with dependency checks
- **Testing Integration**: Built-in simple MCP testing
- **Status Dashboard**: Comprehensive system status overview

#### Maintenance & Operations
- **Cleanup Operations**: Safe container shutdown procedures
- **Reset Functionality**: Complete system reset with data removal
- **Log Access**: Easy access to container logs
- **Health Checks**: Comprehensive service monitoring

### 🚀 Migration Guide

#### For Existing Users
Replace old script calls with new unified commands:

```bash
# Old → New
./scripts/mongodb.sh start        → ./manage.sh mongodb start
./scripts/start.sh               → ./manage.sh app start
./scripts/dev.sh                 → ./manage.sh app dev
./scripts/mongo-gui.sh start     → ./manage.sh gui start
```

#### For npm Scripts
All existing npm scripts continue to work but now use the unified backend:

```bash
npm run mongodb:start    # Still works, now uses manage.sh
npm run dev:safe         # Still works, now uses manage.sh
npm run data:inject      # Still works, now uses manage.sh
```

### 📋 Breaking Changes
- **Script Files**: Individual shell scripts removed (functionality preserved in manage.sh)
- **Direct Script Calls**: Direct calls to removed scripts will fail

### 🔄 Backwards Compatibility
- **npm Scripts**: All package.json scripts maintain same interface
- **Functionality**: All previous features preserved and enhanced
- **Configuration**: Same MongoDB and application settings

### 🎯 Benefits
- **Simplified Management**: Single entry point for all operations
- **Reduced Complexity**: Fewer files to maintain
- **Better Error Handling**: Consistent error reporting across all operations
- **Improved Documentation**: Centralized command reference
- **Enhanced Reliability**: Better dependency checking and validation

---

## [1.0.0] - 2024-09-10

### Initial Release

#### Added
- **MCP Server**: Model Context Protocol implementation for family dietary management
- **Group Management**: Create and manage family groups with member profiles
- **Dietary Profiles**: Track allergies, restrictions, and preferences
- **MongoDB Integration**: Robust data storage with Docker support
- **TypeScript Implementation**: Full type safety and modern JavaScript features
- **Development Tools**: Comprehensive shell scripts for development workflow
- **Testing Framework**: Jest-based testing with integration tests
- **VS Code Integration**: MCP server configuration for VS Code development

#### Features
- Family group creation and management
- Member dietary profile tracking
- Allergen and preference pattern matching
- MongoDB containerization
- Mongo Express web interface
- TypeScript compilation and watch mode
- Test data injection
- Simple MCP protocol testing

#### Documentation
- Comprehensive README with setup instructions
- API documentation for MCP tools
- Development workflow guides
- Docker configuration examples
