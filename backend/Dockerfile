
## 3. Docker Configuration Files
FROM node:18-alpine

WORKDIR /app

# Install build dependencies for native modules (canvas, etc.)
RUN apk add --no-cache python3 make g++ pkgconfig pixman-dev cairo-dev pango-dev jpeg-dev giflib-dev

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create uploads directory
RUN mkdir -p uploads logs

EXPOSE 5000

CMD ["npm", "start"]