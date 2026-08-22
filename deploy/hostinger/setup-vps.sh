#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOMAIN="${DOMAIN:-}"
SERVICE_NAME="ai-interview-backend"
NGINX_SITE="ai-interview"
BACKEND_PORT="${BACKEND_PORT:-5000}"

if [[ -z "${DOMAIN}" ]]; then
  echo "Usage: DOMAIN=your-domain.com bash deploy/hostinger/setup-vps.sh"
  exit 1
fi

if [[ ! -f "${APP_DIR}/backend/.env" ]]; then
  echo "Missing backend/.env. Copy backend/.env.example and fill in the required secrets first."
  exit 1
fi

chmod 600 "${APP_DIR}/backend/.env" || true

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs
fi

sudo apt update
sudo apt install -y nginx

cd "${APP_DIR}/backend"
npm ci
npm run build

cd "${APP_DIR}/frontend"
npm ci
npm run build

sudo tee "/etc/systemd/system/${SERVICE_NAME}.service" >/dev/null <<EOF
[Unit]
Description=AI Interview backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=${APP_DIR}/backend
Environment=NODE_ENV=production
EnvironmentFile=${APP_DIR}/backend/.env
ExecStart=$(command -v node) ${APP_DIR}/backend/dist/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo tee "/etc/nginx/sites-available/${NGINX_SITE}" >/dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    root ${APP_DIR}/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

sudo ln -sfn "/etc/nginx/sites-available/${NGINX_SITE}" "/etc/nginx/sites-enabled/${NGINX_SITE}"
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now "${SERVICE_NAME}"
sudo systemctl restart "${SERVICE_NAME}"
sudo systemctl reload nginx

echo "Deployment finished."
echo "Frontend: https://${DOMAIN}"
echo "Health:   https://${DOMAIN}/api/health"