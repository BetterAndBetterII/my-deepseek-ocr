# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app

# Enable pnpm via corepack (recommended)
RUN corepack enable && corepack prepare pnpm@9.12.2 --activate

# Only copy lockfile and package manifest first for better layer caching
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy the rest and build
COPY . .
RUN pnpm build

# --- Runtime stage ---
FROM nginx:1.27-alpine AS runtime

# Install envsubst for templating nginx config
RUN apk add --no-cache bash curl gettext

# Copy build output
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx template and custom entrypoint
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENV BACKEND_URL="http://localhost:8000"

CMD ["/docker-entrypoint.sh"]

