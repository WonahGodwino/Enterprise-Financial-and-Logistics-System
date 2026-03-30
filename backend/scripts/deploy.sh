#!/bin/bash

# Mapsi Group EFMS Deployment Script
set -e

echo "🚀 Starting Mapsi EFMS Deployment..."

# Configuration
APP_NAME="mapsi-efms"
DEPLOY_DIR="/var/www/$APP_NAME"
BACKUP_DIR="/var/backups/$APP_NAME"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    command -v node >/dev/null 2>&1 || { log_error "Node.js is required but not installed."; exit 1; }
    command -v npm >/dev/null 2>&1 || { log_error "npm is required but not installed."; exit 1; }
    command -v pm2 >/dev/null 2>&1 || { log_warn "PM2 not installed. Installing..."; npm install -g pm2; }
    command -v psql >/dev/null 2>&1 || { log_error "PostgreSQL client is required but not installed."; exit 1; }
    
    log_info "✅ Prerequisites check passed"
}

# Backup current version
backup_current() {
    log_info "Creating backup of current version..."
    
    if [ -d "$DEPLOY_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        tar -czf "$BACKUP_DIR/$APP_NAME-$TIMESTAMP.tar.gz" -C "$(dirname $DEPLOY_DIR)" "$(basename $DEPLOY_DIR)"
        log_info "✅ Backup created at $BACKUP_DIR/$APP_NAME-$TIMESTAMP.tar.gz"
    else
        log_warn "No existing deployment found"
    fi
}

# Clone/update repository
update_code() {
    log_info "Updating application code..."
    
    if [ -d "$DEPLOY_DIR" ]; then
        cd "$DEPLOY_DIR"
        git fetch origin
        git reset --hard origin/main
    else
        git clone https://github.com/mapsigroup/efms.git "$DEPLOY_DIR"
        cd "$DEPLOY_DIR"
    fi
    
    log_info "✅ Code updated successfully"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    # Backend
    cd "$DEPLOY_DIR/backend"
    npm ci --only=production
    
    # Frontend
    cd "$DEPLOY_DIR/frontend"
    npm ci
    npm run build
    
    log_info "✅ Dependencies installed"
}

# Setup environment
setup_environment() {
    log_info "Setting up environment..."
    
    cd "$DEPLOY_DIR"
    
    # Create .env files from examples
    if [ ! -f "backend/.env" ]; then
        cp backend/.env.example backend/.env
        log_warn "Please update backend/.env with production values"
    fi
    
    if [ ! -f "frontend/.env" ]; then
        cp frontend/.env.example frontend/.env
        log_warn "Please update frontend/.env with production values"
    fi
    
    log_info "✅ Environment files created"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    cd "$DEPLOY_DIR/backend"
    npx prisma migrate deploy
    npx prisma generate
    
    log_info "✅ Migrations completed"
}

# Seed database (optional)
seed_database() {
    log_info "Seeding database..."
    
    cd "$DEPLOY_DIR/backend"
    
    read -p "Do you want to seed the database? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm run seed
        log_info "✅ Database seeded"
    else
        log_warn "Skipping database seed"
    fi
}

# Start application
start_application() {
    log_info "Starting application..."
    
    cd "$DEPLOY_DIR/backend"
    
    # Stop existing processes
    pm2 delete $APP_NAME 2>/dev/null || true
    
    # Start with PM2
    pm2 start src/app.js --name "$APP_NAME" --watch
    pm2 save
    
    log_info "✅ Application started"
}

# Setup Nginx (if needed)
setup_nginx() {
    log_info "Setting up Nginx..."
    
    if [ -f "/etc/nginx/sites-available/$APP_NAME" ]; then
        sudo ln -sf "/etc/nginx/sites-available/$APP_NAME" "/etc/nginx/sites-enabled/"
        sudo nginx -t && sudo systemctl reload nginx
        log_info "✅ Nginx configured"
    else
        log_warn "Nginx configuration not found"
    fi
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    sleep 10
    
    if curl -s http://localhost:5000/health | grep -q "OK"; then
        log_info "✅ Health check passed"
    else
        log_error "Health check failed"
        exit 1
    fi
}

# Main deployment process
main() {
    log_info "Starting deployment process for $APP_NAME"
    
    check_prerequisites
    backup_current
    update_code
    install_dependencies
    setup_environment
    run_migrations
    seed_database
    start_application
    setup_nginx
    health_check
    
    log_info "🎉 Deployment completed successfully!"
    log_info "Application is running at http://$(hostname -I | awk '{print $1}')"
}

# Run main function
main