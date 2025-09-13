# Multi-stage Dockerfile for Family Serve Delicious MCP Server

FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

COPY .npmrc* ./

ARG GITHUB_TOKEN

RUN echo "🔧 Setting up GitHub npm authentication..." && \
    if [ -n "$GITHUB_TOKEN" ]; then \
        echo "📝 Using GITHUB_TOKEN from build argument"; \
        echo "@axyor:registry=https://npm.pkg.github.com" > .npmrc; \
        echo "//npm.pkg.github.com/:_authToken=$GITHUB_TOKEN" >> .npmrc; \
    elif [ -f ".npmrc" ]; then \
        echo "📝 Using existing .npmrc file"; \
    else \
        echo "❌ No authentication method found!"; \
        echo "Please configure your GitHub token using one of these methods:"; \
        echo "1. Set GITHUB_TOKEN in .env file"; \
        echo "2. Create .npmrc file with token"; \
        echo "3. Run ./configure-github-token.sh for help"; \
        exit 1; \
    fi

RUN echo "📦 Installing npm dependencies..." && \
    npm ci

COPY src/ ./src/
COPY config/ ./config/

RUN echo "🔨 Building TypeScript application..." && \
    npm run build

RUN rm -f .npmrc

FROM node:22-alpine AS production

WORKDIR /app

COPY package*.json ./

ARG GITHUB_TOKEN
RUN echo "🔧 Setting up GitHub npm authentication for production stage..." && \
    if [ -n "$GITHUB_TOKEN" ]; then \
        echo "📝 Using GITHUB_TOKEN from build argument"; \
        echo "@axyor:registry=https://npm.pkg.github.com" > .npmrc; \
        echo "//npm.pkg.github.com/:_authToken=$GITHUB_TOKEN" >> .npmrc; \
    else \
        echo "❌ No GITHUB_TOKEN provided for production stage"; \
        exit 1; \
    fi

# Install only production dependencies
RUN echo "📦 Installing production dependencies..." && \
    npm ci --omit=dev && npm cache clean --force

RUN rm -f .npmrc

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config ./config

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["npm", "start"]
