FROM node:18-alpine

WORKDIR /app

# Install build dependencies for native modules (canvas, etc.) and OpenSSL for Prisma
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    pkgconfig \
    pixman-dev \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    openssl \
    openssl-dev \
    ca-certificates

# Install dependencies
COPY package*.json ./
RUN npm install --only=production --no-audit --no-fund

# Copy application code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create uploads directory
RUN mkdir -p uploads logs

EXPOSE 5000

# Start command
CMD ["npm", "start"]
