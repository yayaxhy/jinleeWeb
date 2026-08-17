# Next.js Behind Nginx

This project should not expose `next start` directly on public port `80`.

Recommended topology:

- Public: Nginx listens on `80/443`
- Private: Next.js listens on `127.0.0.1:3000`
- Firewall/security group: do not open `3000` to the internet

## PM2

Start the app with PM2 so it only binds to localhost:

```bash
cd /www/wwwroot/jinleeWeb
npm install
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

`ecosystem.config.cjs` also starts the monthly financial-report, WeChat Native reconciliation, and login-audit retention schedulers. Put `INTERNAL_API_TOKEN` in `.env.local`; the schedulers read `.env.local` before calling their internal endpoints.

For encrypted login-IP evidence, set the following values in `.env.local` before starting PM2:

```bash
AUTH_LOGIN_AUDIT_ENCRYPTION_KEY=<base64-encoded-32-byte-key>
AUTH_LOGIN_AUDIT_RETENTION_DAYS=365
```

Generate and retain the encryption key securely; rotating or losing it prevents old IP records from being decrypted. The app continues to authenticate users when this key is absent, but login events will not include an IP address.

Verify the listener:

```bash
ss -lntp | grep 3000
curl -I http://127.0.0.1:3000
```

Expected: `127.0.0.1:3000` is listening. It should not appear as `0.0.0.0:3000`.

## Nginx

Example server block:

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name your-domain.example.com;

    client_max_body_size 20m;

    ssl_certificate     /www/server/panel/vhost/cert/your-domain/fullchain.pem;
    ssl_certificate_key /www/server/panel/vhost/cert/your-domain/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
```

If Nginx is behind Cloudflare or another proxy, configure Nginx's real-IP module so `$remote_addr` is first replaced with the trusted proxy's client IP before forwarding `X-Real-IP` to Next.js.

If you use Baota/BT Panel, put the same reverse proxy target in the site config:

- Target URL: `http://127.0.0.1:3000`
- Preserve Host header: enabled

## Security Checklist

1. Upgrade Next.js to the patched production version you intend to run.
2. Rebuild and restart PM2 after every upgrade.
3. Ensure only Nginx is reachable publicly on `80/443`.
4. Block direct inbound access to `3000` in Tencent Cloud security groups and local firewall.
5. Review app and Nginx logs for abnormal requests to `/_next/`, RSC, middleware, and server action endpoints.
6. If the app was exposed while on an older vulnerable version, rotate secrets in `.env`.

## Quick Checks

```bash
node -p "require('./node_modules/next/package.json').version"
npm ls next react react-dom --depth=0
ss -lntp | grep -E '(:80|:443|:3000)'
```

Desired result:

- Nginx on public `80/443`
- Next.js only on `127.0.0.1:3000`
- No direct public listener for Node on `80` or `3000`
