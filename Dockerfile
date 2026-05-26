FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

# Install Python, pip, and compilation tools
RUN apk add --no-cache python3 py3-pip build-base

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/tsconfig*.json ./
COPY --from=builder /app/rhyme_server.py ./
COPY --from=builder /app/rhyme_data.db ./
COPY --from=builder /app/requirements.txt ./

# Install python dependencies
RUN pip install --no-cache-dir --break-system-packages -r requirements.txt

EXPOSE 5001
ENV NODE_ENV=production
CMD ["npx", "concurrently", "--kill-others", "\"npx tsx server/index.ts\"", "\"python3 -m uvicorn rhyme_server:app --host 127.0.0.1 --port 8001\""]
