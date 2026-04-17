FROM node:20-alpine

WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm install --omit=dev

# Copy source
COPY . .

# better-sqlite3 needs build tools — rebuild after copy
RUN apk add --no-cache python3 make g++ \
  && npm rebuild better-sqlite3 \
  && apk del python3 make g++

EXPOSE 8080

CMD ["node", "server.js"]
