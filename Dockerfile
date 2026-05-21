FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/tsconfig*.json ./
EXPOSE 5001
ENV NODE_ENV=production
CMD ["npx", "tsx", "server/index.ts"]
