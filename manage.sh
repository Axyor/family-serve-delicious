#!/bin/bash

# Family Serve Delicious - Essential Management Script
# Focused on setup, configuration and complex operations
# Daily Docker operations are handled by npm scripts

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
print_header() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  Family Serve Delicious Setup${NC}"
    echo -e "${CYAN}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_status() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

check_docker_compose() {
    if ! command -v docker-compose >/dev/null 2>&1 && ! command -v docker compose >/dev/null 2>&1; then
        print_error "Docker Compose not found. Please install Docker Compose."
        print_info "Visit: https://docs.docker.com/compose/install/"
        exit 1
    fi
}

get_docker_compose_cmd() {
    if command -v docker-compose >/dev/null 2>&1; then
        echo "docker-compose"
    elif command -v docker compose >/dev/null 2>&1; then
        echo "docker compose"
    fi
}

github_token_setup() {
    print_info "Configuring GitHub token for private package access..."
    echo ""
    
    if [ -f ".env" ] && grep -q "GITHUB_TOKEN=" .env; then
        token=$(grep "GITHUB_TOKEN=" .env | cut -d'=' -f2)
        if [ -n "$token" ] && [ "$token" != "your_github_token_here" ]; then
            print_success "GitHub token already configured"
            return 0
        fi
    fi
    
    print_warning "GitHub token not found or invalid"
    echo ""
    echo -e "${YELLOW}📝 To create a GitHub Personal Access Token:${NC}"
    echo "1. Go to: https://github.com/settings/tokens"
    echo "2. Click 'Generate new token (classic)'"
    echo "3. Give it a name (e.g., 'Family Serve Delicious')"
    echo "4. Select scopes: ✓ read:packages"
    echo "5. Click 'Generate token'"
    echo ""
    
    read -p "Enter your GitHub token (or press Enter to skip): " github_token
    
    if [ -n "$github_token" ]; then
        if [ -f ".env" ]; then
            if grep -q "GITHUB_TOKEN=" .env; then
                sed -i "s/GITHUB_TOKEN=.*/GITHUB_TOKEN=$github_token/" .env
            else
                echo "GITHUB_TOKEN=$github_token" >> .env
            fi
        else
            cp .env.example .env
            sed -i "s/your_github_token_here/$github_token/" .env
        fi
        
        print_success "GitHub token configured in .env file"
        
        # Test the token
        print_info "Testing token..."
        if npm install --dry-run > /dev/null 2>&1; then
            print_success "Token is working! You can access the private package."
        else
            print_warning "Token test failed. Please verify your token."
        fi
    else
        print_warning "GitHub token configuration skipped"
        print_info "You can configure it later by running: ./manage.sh setup"
        return 1
    fi
}

project_setup() {
    print_header
    echo ""
    print_status "Setting up Family Serve Delicious project..."
    echo ""
    
    check_docker_compose
    
    print_info "Step 1: GitHub token configuration"
    github_token_setup
    echo ""
    
    print_info "Step 2: Building application"
    npm run build
    echo ""
    
    print_info "Step 3: Database setup"
    print_info "Run: npm run db:start"
    echo ""
    
    print_success "Setup completed!"
    print_info "Quick start: npm run dev"
}

lm_studio_config() {
    print_status "Generating LM Studio configuration..."
    
    local current_dir=$(pwd)
    local config_file="config/lm_studio_mcp_config.json"
    
    # Load MongoDB credentials from .env if available
    local mongodb_uri="${MONGODB_URI:-mongodb://localhost:27017/family_serve}"
    if [ -f ".env" ]; then
        source .env 2>/dev/null || true
        if [ -n "$MONGODB_USERNAME" ] && [ -n "$MONGODB_PASSWORD" ]; then
            mongodb_uri="mongodb://${MONGODB_USERNAME}:${MONGODB_PASSWORD}@localhost:27017/family_serve?authSource=admin"
        fi
    fi
    
    cat > "$config_file" << EOFCONFIG
{
  "servers": {
    "family-serve-delicious": {
      "command": "node",
      "args": ["$current_dir/dist/index.js"],
      "env": {
        "MONGODB_URI": "$mongodb_uri",
        "NODE_ENV": "production",
        "OUTPUT_VALIDATION_MODE": "warn",
        "OUTPUT_VALIDATION_MAX_LENGTH": "50000",
        "OUTPUT_VALIDATION_LOG_PATH": "$current_dir/logs/output-validation.log"
      }
    }
  }
}
EOFCONFIG
    
    print_success "Configuration generated: $config_file"
    print_info "Copy this configuration to your LM Studio mcp_servers.json file"
    print_info "Location varies by OS:"
    print_info "  Windows: %APPDATA%\\LMStudio\\mcp_servers.json"
    print_info "  macOS: ~/Library/Application Support/LMStudio/mcp_servers.json" 
    print_info "  Linux: ~/.config/LMStudio/mcp_servers.json"
    echo ""
    print_status "Configuration content:"
    cat "$config_file"
}

lm_studio_help() {
    print_status "Opening LM Studio setup guide..."
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "docs/LM_STUDIO_SETUP.md" >/dev/null 2>&1 &
    elif command -v open >/dev/null 2>&1; then
        open "docs/LM_STUDIO_SETUP.md" >/dev/null 2>&1 &
    else
        print_info "Please open docs/LM_STUDIO_SETUP.md for detailed instructions"
    fi
}

claude_desktop_config() {
    print_status "Generating Claude Desktop configuration..."
    
    local current_dir=$(pwd)
    local config_file="config/claude_desktop_mcp_config.json"
    
    local mongodb_uri="${MONGODB_URI:-mongodb://localhost:27017/family_serve}"
    if [ -f ".env" ]; then
        source .env 2>/dev/null || true
        if [ -n "$MONGODB_USERNAME" ] && [ -n "$MONGODB_PASSWORD" ]; then
            mongodb_uri="mongodb://${MONGODB_USERNAME}:${MONGODB_PASSWORD}@localhost:27017/family_serve?authSource=admin"
        fi
    fi
    
    cat > "$config_file" << EOFCLAUDECONFIG
{
  "mcpServers": {
    "family-serve-delicious": {
      "command": "node",
      "args": ["$current_dir/dist/index.js"],
      "env": {
        "MONGODB_URI": "$mongodb_uri",
        "NODE_ENV": "production",
        "OUTPUT_VALIDATION_MODE": "warn",
        "OUTPUT_VALIDATION_MAX_LENGTH": "50000",
        "OUTPUT_VALIDATION_LOG_PATH": "$current_dir/logs/output-validation.log"
      }
    }
  }
}
EOFCLAUDECONFIG
    
    print_success "Configuration generated: $config_file"
    print_info "Copy this configuration to your Claude Desktop config file"
    print_info "Location varies by OS:"
    print_info "  Windows: %APPDATA%\\Claude\\claude_desktop_config.json"
    print_info "  macOS: ~/Library/Application Support/Claude/claude_desktop_config.json" 
    print_info "  Linux: ~/.config/Claude/claude_desktop_config.json"
    echo ""
    print_status "Configuration content:"
    cat "$config_file"
    echo ""
    print_info "💡 Note: Make sure to start MongoDB before using Claude Desktop:"
    print_info "  npm run db:start"
}

claude_desktop_help() {
    print_status "Opening Claude Desktop setup guide..."
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "docs/CLAUDE_DESKTOP_SETUP.md" >/dev/null 2>&1 &
    elif command -v open >/dev/null 2>&1; then
        open "docs/CLAUDE_DESKTOP_SETUP.md" >/dev/null 2>&1 &
    else
        print_info "Please open docs/CLAUDE_DESKTOP_SETUP.md for detailed instructions"
    fi
    
    echo ""
    print_info "Quick setup summary:"
    print_info "1. Install Claude Desktop app"
    print_info "2. Use './manage.sh claude config' to generate config"
    print_info "3. Copy config to Claude Desktop config file"
    print_info "4. Start MongoDB: npm run db:start"
    print_info "5. Restart Claude Desktop to load the server"
    echo ""
    print_info "For detailed instructions, see: docs/CLAUDE_DESKTOP_SETUP.md"
}

reset_system() {
    print_warning "This will remove ALL Docker containers, networks, and volumes!"
    read -p "Are you sure? (y/N): " confirm
    
    if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
        local compose_cmd=$(get_docker_compose_cmd)
        print_status "Resetting entire system..."
        
        $compose_cmd down -v 2>/dev/null || true
        $compose_cmd -f docker-compose.dev.yml down -v 2>/dev/null || true
        
        read -p "Also clean Docker system cache? (y/N): " clean_docker
        if [[ $clean_docker == [yY] || $clean_docker == [yY][eE][sS] ]]; then
            docker system prune -f
            docker volume prune -f
        fi
        
        print_success "System reset completed"
        print_info "Run './manage.sh setup' to reconfigure"
    else
        print_info "Reset cancelled"
    fi
}

show_help() {
    print_header
    echo ""
    echo "Essential operations for Family Serve Delicious"
    echo ""
    echo -e "${CYAN}Setup & Configuration:${NC}"
    echo "  setup              Complete project setup"
    echo "  lmstudio config    Generate LM Studio configuration"
    echo "  lmstudio help      Open LM Studio setup guide"
    echo "  claude config      Generate Claude Desktop configuration"
    echo "  claude help        Show Claude Desktop setup guide"
    echo ""
    echo -e "${CYAN}System Operations:${NC}"  
    echo "  reset              Complete system reset (destructive)"
    echo "  help               Show this help"
    echo ""
    echo -e "${CYAN}Daily Development (use npm scripts):${NC}"
    echo "  npm run dev        Start development environment"
    echo "  npm run prod       Start production environment" 
    echo "  npm run stop       Stop all services"
    echo "  npm run db:gui     Open database GUI"
    echo "  npm run status     Show container status"
    echo "  npm run logs       Show container logs"
    echo ""
    echo -e "${CYAN}Examples:${NC}"
    echo "  ./manage.sh setup              "
    echo "  npm run dev                    "
    echo "  npm run db:gui                 "
    echo "  ./manage.sh lmstudio config    "
    echo "  ./manage.sh claude config      "
}
case "${1:-help}" in
    "setup") project_setup ;;
    "lmstudio")
        case "${2:-help}" in
            "config") lm_studio_config ;;
            "help") lm_studio_help ;;
            *) 
                print_error "Unknown lmstudio command: $2"
                print_info "Available: config, help"
                ;;
        esac
        ;;
    "claude")
        case "${2:-help}" in
            "config") claude_desktop_config ;;
            "help") claude_desktop_help ;;
            *) 
                print_error "Unknown claude command: $2"
                print_info "Available: config, help"
                ;;
        esac
        ;;
    "reset") reset_system ;;
    "help"|"--help"|"-h") show_help ;;
    *) 
        print_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
