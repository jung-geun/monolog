# monolog

> This project is an improved fork based on the original [morethan-log](https://github.com/morethanmin/morethan-log) project. We deeply appreciate the excellent work of the original developer, and have implemented additional features on top of that foundation.

**Original Project**: [morethan-log](https://github.com/morethanmin/morethan-log) by [morethanmin](https://github.com/morethanmin)

[Demo Blog](https://blog.pieroot.xyz) | [Demo Resume](https://blog.pieroot.xyz/resume)

<img width="1715" alt="image" src="https://user-images.githubusercontent.com/72514247/209824600-ca9c8acc-6d2d-4041-9931-43e34b8a9a5f.png">

A Next.js-based static blog using Notion as a Content Management System (CMS). This improved version offers enhanced Notion integration, automatic updates, and additional features.

## 🚀 Key Features

### 🔧 Enhanced Notion Integration
- **Comprehensive Notion Block Support**: Full support for advanced Notion blocks including databases, toggles, callouts, and more
- **Improved Media Handling**: Enhanced image proxy and media content processing
- **Custom Components**: Extended rendering for Notion-specific features

### ⚡ Automatic Updates & Performance
- **Automatic ISR Refresh**: Periodic content updates through GitHub Actions workflows
- **Optimized Caching**: Enhanced caching strategies for better performance
- **Robust Error Handling**: Strong error handling and fallback mechanisms

### 🛠️ Development & Testing
- **Comprehensive Testing**: Jest test suite with coverage reports
- **CI/CD Pipeline**: Automated testing and deployment workflows
- **Code Quality**: ESLint, Prettier, and TypeScript strict mode applied

### 🎨 Enhanced UI/UX
- **Improved Theme System**: Better dark/light mode switching
- **Mobile Optimization**: Enhanced responsive design
- **Accessibility**: Improved ARIA labels and keyboard navigation

### 📒 Writing with Notion
- No need to commit to GitHub for blog posts
- Articles written in Notion are automatically updated on the site

### 📄 Use as Resume Page
- Create full-page sites using Notion
- Can be used for resumes, portfolios, and more

### 🤖 Various Plugin Support via Configuration
- Update profile information via `site.config.js`
- Supports plugins like Google Analytics, Search Console, Utterances (GitHub Issues comments), Cusdis, and more

## 🐳 Docker Image Tags

This project provides Docker images via GitHub Container Registry. According to the `docker-build.yml` workflow, the following tags are automatically generated:

| Tag | Description | When Generated |
|-----|-------------|----------------|
| `latest` | Current production image | When `main` is pushed, or a `v*` release tag is pushed |
| `X.Y.Z` | Versioned release image | When its `vX.Y.Z` tag is pushed |

### Additional Tags

When a Semver tag is pushed (for example, `v1.2.3`), the workflow publishes:
- `1.2.3` — full release version
- `latest` — current release image

## 📖 Getting Started

1. Click ⭐ Star on this repository.
2. [Fork](https://github.com/jung-geun/monolog/fork) to your profile.
3. Duplicate the [Notion template](https://pieroot.notion.site/307067c015d080d987eadd99c8369f92?v=307067c015d0817a87a8000c109eb446&source=copy_link) and enable "Share to web".
4. Copy the DB IDs for the required databases in UUID format and collect each DB's `data_source` ID (see API docs for `data_sources[0].id`).
5. Clone the forked repository and customize `site.config.js` as desired.
6. Choose one of the deployment methods below.

### Environment Variables

| Variable Name | Required | Description |
|---------------|----------|-------------|
| `NOTION_TOKEN` | Required | Notion integration token |
| `NOTION_DATASOURCE_ID` | Required | Notion datasource ID for posts DB (UUID) |
| `NOTION_COMMENTS_DATASOURCE_ID` | Optional | `data_source` ID for comments DB |
| `COMMENT_HASH_SALT` | Optional | Salt for anonymous comment identity (`openssl rand -hex 32`) |
| `REVALIDATE_SECRET` | Optional | Token used by `/api/revalidate`, `/api/init`, `/api/cron/graph` |
| `NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID` | Optional | For Google Analytics plugin |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Optional | For Google Search Console plugin |
| `NEXT_PUBLIC_NAVER_SITE_VERIFICATION` | Optional | For Naver Search Advisor plugin |
| `NEXT_PUBLIC_UTTERANCES_REPO` | Optional | For Utterances plugin |

`NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, and `NEXT_PUBLIC_NAVER_SITE_VERIFICATION` are read when the container starts, not when the image is built. Supply only public values through `--env-file` or Compose `env_file`; omit them to run with Analytics and verification tags disabled.

## 🐳 Docker Compose deployment

The production path is a native local Docker build. It runs the dynamic Next.js application, Redis, and Qdrant on the Mac mini; only the `blog` service is reachable by HAProxy.

### Required Compose inputs

Copy the template, then fill every enabled integration:

```bash
cp .env.example .env
openssl rand -hex 32 # use this for TRUSTED_PROXY_SECRET and independent comment/visitor salts
```

| Variable | Required | Description |
|---|---|---|
| `BLOG_BIND_ADDRESS` | Yes | DHCP-reserved Mac LAN address reachable from the separate HAProxy host. Use `127.0.0.1` only when HAProxy is native on the Mac. |
| `NOTION_TOKEN` | Yes | Notion integration token |
| `NOTION_DATASOURCE_ID` | Yes | Notion posts `data_source` ID |
| `REVALIDATE_SECRET` | Yes | Must match the GitHub Actions revalidation secret |
| `TRUSTED_PROXY_SECRET` | Yes | Shared secret that HAProxy overwrites into `X-Monolog-Proxy-Secret` |
| `NEXT_PUBLIC_SITE_URL` | Yes | `https://blog.pieroot.xyz`; compiled into the native image |
| `REVALIDATE_HOURS` | Yes | ISR interval; default template value is `1` |
| `NOTION_COMMENTS_DATASOURCE_ID`, `COMMENT_HASH_SALT` | When comments enabled | Comment data source and independent pseudonym salt |
| `NOTION_VISIT_STATS_DATASOURCE_ID`, `VISITOR_HASH_SALT` | When visitor stats enabled | Visit data source and independent visitor salt |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | When ontology/vector build enabled | Optional ontology extraction and embedding credentials |

`TRUSTED_PROXY_HOPS` is fixed to `1` inside Compose. Redis and Qdrant are private Compose services; do not set their public URLs in `.env`.

### Mac mini and HAProxy setup

1. Create a dedicated standard `monolog` macOS account, install current Docker Desktop there, clone this repository, create `.env`, and run the commands below from that checkout.
2. Give both the Mac mini and HAProxy host DHCP reservations. Set `BLOG_BIND_ADDRESS` to the Mac's reserved LAN address.
3. Configure the existing HAProxy backend to that explicit address and port. Preserve `Host`, set `X-Forwarded-Proto: https`, enable `option forwardfor`, and **overwrite** `X-Monolog-Proxy-Secret` with the exact `TRUSTED_PROXY_SECRET` from the Mac `.env`. Never forward a client-provided value for that header.
4. HAProxy remains the TLS owner and the single trusted hop for `blog.pieroot.xyz`. Do not publish Qdrant or add another TLS proxy.
5. This unattended-recovery policy deliberately removes macOS at-rest disk encryption: disable FileVault, enable automatic login for `monolog`, enable Docker Desktop startup at login, prevent automatic system sleep while the display is off, and enable restart after power failure. Retaining or re-enabling FileVault requires manual unlock/login after every reboot.
6. Point the GitHub revalidation workflow's `REVALIDATE_URL` secret to `https://blog.pieroot.xyz`; its `REVALIDATE_SECRET` must equal the Mac `.env` value.

If pre-existing `logs-data` or `image-cache` volumes are root-owned, preserve them and repair ownership once before startup:

```bash
docker compose run --rm --user root --entrypoint chown blog -R 1001:1001 /app/logs /app/.image-cache
```

### Operations

```bash
# Validate required interpolation without starting services.
make config

# Native local build; waits for blog, Redis, and Qdrant health checks.
make up

# Inspect stack state or follow bounded container logs.
make ps
make logs

# Recreate without deleting named volumes, or stop the stack.
make restart
make down
```

`make down` intentionally never removes volumes. Back up Redis RDB data and Qdrant snapshots to an existing off-machine destination before treating this Mac as the sole durable ontology/vector store.

### Production checks

After HAProxy is configured, verify the direct bound origin and public TLS route:

```bash
set -a; . ./.env; set +a
curl -fsS "http://${BLOG_BIND_ADDRESS}:3000/" -o /dev/null
curl -fsSI https://blog.pieroot.xyz/
curl -fsS -H "Authorization: Bearer ${REVALIDATE_SECRET}" \
  "http://${BLOG_BIND_ADDRESS}:3000/api/revalidate?path=/"
```

## ❓ FAQ

<details>
   <summary>View FAQ</summary>

   **Q1: After creating avatar.svg, how do I create favicon.ico and apple-touch-icon.png?**

   A1: Refer to https://www.favicon-generator.org/.

   **Q2: Do I need to manually configure the sitemap file?**

   A2: The system automatically generates sitemap.xml, so you don't need to configure it manually.

   **Q3: Why don't Notion posts update automatically?**

   A3: Set revalidateTime in site.config.js and observe how long updates take.

   **Q4: What should I enter for NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID and NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION in site.config.js?**

   A4: Refer to https://github.com/jung-geun/monolog/issues/203. It may take some time for updates to be reflected after configuration.

   **Q5: The Docker container won't run.**

   A5: Make sure `NOTION_TOKEN`, `NOTION_DATASOURCE_ID`, `REVALIDATE_SECRET`, `TRUSTED_PROXY_SECRET`, and `BLOG_BIND_ADDRESS` are set in `.env`. For comments, use `NOTION_COMMENTS_DATASOURCE_ID` (the data_source ID, not the database ID). Validate interpolation with `make config`, then inspect the stack with `make logs`.

   If you encounter other issues, feel free to register them in GitHub Issues. It helps other users too!

</details>

## 🤝 Contributing

Please check the [Contributing Guide](.github/CONTRIBUTING.md).

## 📄 License

This project follows the [MIT License](LICENSE).