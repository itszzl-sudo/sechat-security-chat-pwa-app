#!/bin/bash
set -e

echo "=== SeChatbot Bootstrap ==="
echo "[1/5] Updating packages..."
apt-get update -qq
apt-get upgrade -y -qq
echo "[2/5] Installing deps..."
apt-get install -y -qq curl wget git nginx certbot python3-certbot-nginx
echo "[3/5] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y -qq nodejs
echo "Node: "$(node --version)""
echo "[4/5] Installing Docker..."
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
echo "[5/5] Setting up firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "=== Bootstrap Complete ==="
