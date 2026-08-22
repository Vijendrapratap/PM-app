# Hostinger VPS Deployment

This repo is already structured for a VPS deployment with one Express API and one Vite frontend. The simplest production setup on Hostinger is:

1. Build the backend with Node.
2. Serve the frontend build as static files.
3. Put nginx in front of both and proxy `/api` to the backend.

## Target layout

- Frontend: `https://your-domain.com`
- Backend API: `https://your-domain.com/api`
- Backend process: `127.0.0.1:5000`

This works with the current code because the frontend falls back to same-origin `/api` in production, and the backend accepts a frontend origin from `FRONTEND_URL`.

## 1. Prepare the VPS

Install packages on the server:

```bash
sudo apt update
sudo apt install -y git nginx curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Allow web traffic if you use UFW:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

If you want the fastest path, use the helper script in [deploy/hostinger/setup-vps.sh](../deploy/hostinger/setup-vps.sh). It installs the app dependencies, writes the service files, and reloads nginx for you.

## 2. Clone the repo

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone <your-repo-url> ai-interview
sudo chown -R $USER:$USER /var/www/ai-interview
```

## 3. Configure the backend

Use the values from [backend/.env.example](../backend/.env.example) and set them in `backend/.env` on the server.

Required values for production:

- `PORT=5000`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `FRONTEND_URL=https://your-domain.com`
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` for first boot, if you want bootstrap seeding

Optional values:

- `OPENAI_API_KEY`
- `OPENAI_AGENT_MODEL`
- `OPENROUTER_API_KEY`
- `OPENROUTER_AGENT_MODEL`

If you want hosted model drafting, keep the key on the backend only. Do not expose it to the frontend.

## 4. Build and run the backend

```bash
cd /var/www/ai-interview/backend
npm ci
npm run build
```

Create a systemd service at `/etc/systemd/system/ai-interview-backend.service`:

```ini
[Unit]
Description=AI Interview backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/ai-interview/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /var/www/ai-interview/backend/dist/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ai-interview-backend
sudo systemctl status ai-interview-backend
```

If your `node` binary is not at `/usr/bin/node`, replace it with the output of `which node`.

## 5. Build the frontend

Use the values from [frontend/.env.example](../frontend/.env.example).

For the Hostinger setup in this guide, you can leave `VITE_API_URL` unset because nginx will serve the frontend and proxy `/api` to the backend on the same domain.

```bash
cd /var/www/ai-interview/frontend
npm ci
npm run build
```

If you choose to host the frontend on a different domain, set `VITE_API_URL` to the full backend URL ending in `/api` before building.

## 6. Configure nginx

Create `/etc/nginx/sites-available/ai-interview`:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    root /var/www/ai-interview/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable the site and reload nginx:

```bash
sudo ln -s /etc/nginx/sites-available/ai-interview /etc/nginx/sites-enabled/ai-interview
sudo nginx -t
sudo systemctl reload nginx
```

## 7. Add HTTPS

Install certbot and issue a certificate:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## 8. Apply Supabase migrations

The backend depends on Supabase/Postgres. Before production traffic, apply the migrations in `backend/supabase/migrations` to your Supabase project in order, then deploy the backend.

Use `backend/supabase/seed_operations_studio.sql` only for demo or development data, not for a real production tenant.

## 9. Smoke test

Check these URLs after deployment:

- `https://your-domain.com`
- `https://your-domain.com/api/health`

If the frontend loads but API calls fail, verify `FRONTEND_URL` in the backend env, nginx proxying for `/api`, and the backend service status.

## Quick rollback

If a new build fails, rebuild the previous commit, restart `ai-interview-backend`, and replace the frontend `dist` folder with the previous build output.

## One-command helper

From the repo root on the VPS:

```bash
DOMAIN=your-domain.com bash deploy/hostinger/setup-vps.sh
```

The script expects `backend/.env` to exist first with your Supabase, JWT, and frontend origin values.
