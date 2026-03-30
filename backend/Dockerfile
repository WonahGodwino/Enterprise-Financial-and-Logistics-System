
## 3. Docker Configuration Files

**`backend/Dockerfile`**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create uploads directory
RUN mkdir -p uploads logs

# Expose port
EXPOSE 5000

# Start application
CMD ["npm", "start"]