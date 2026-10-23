#!/usr/bin/env bash
# Ubuntu 22.04/24.04 EC2 setup: systemd + nginx reverse proxy. Run as root: sudo bash ec2-setup.sh
# Secrets are NOT in this script. Create /etc/creatorhub/backend.env yourself (chmod 600), see backend/.env.example.
set -euo pipefail
REPO_URL="${REPO_URL:?export REPO_URL=https://github.com/you/creatorhub-ai.git}"
APP_DIR=/opt/creatorhub
ENV_FILE=/etc/creatorhub/backend.env
DOMAIN="${DOMAIN:-_}"

apt-get update -y
apt-get install -y python3 python3-venv python3-pip nginx git
id creatorhub &>/dev/null || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin creatorhub
if [ -d "$APP_DIR/.git" ]; then git -C "$APP_DIR" pull; else git clone "$REPO_URL" "$APP_DIR"; fi
python3 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt"
chown -R creatorhub:creatorhub "$APP_DIR"

mkdir -p /etc/creatorhub
if [ ! -f "$ENV_FILE" ]; then
  echo "Create $ENV_FILE (APP_ENV=production, DATABASE_URL, JWT_SECRET, CORS_ORIGINS ...) then re-run." >&2
  exit 1
fi
chmod 600 "$ENV_FILE"; chown root:root "$ENV_FILE"

cat > /etc/systemd/system/creatorhub.service <<UNIT
[Unit]
Description=CreatorHub AI API
After=network.target
[Service]
User=creatorhub
WorkingDirectory=$APP_DIR/backend
EnvironmentFile=$ENV_FILE
ExecStart=$APP_DIR/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=on-failure
[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/nginx/sites-available/creatorhub <<NGINX
server {
  listen 80;
  server_name $DOMAIN;
  location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
NGINX
ln -sf /etc/nginx/sites-available/creatorhub /etc/nginx/sites-enabled/creatorhub
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl daemon-reload
systemctl enable --now creatorhub
systemctl restart nginx
echo "Done. Add HTTPS (e.g. certbot --nginx -d your.domain) before real use."
