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
| `latest` | Official release version | When `v*` tag is pushed (e.g., v1.0.0) |
| `dev` | Development branch version | When `dev` branch is pushed |
| `nightly` | Latest development version | When `main`/`master` branch is pushed |

### Additional Tags

When Semver tags are pushed (e.g., `v1.2.3`):
- `1.2.3` - Full version
- `1.2` - Minor version
- `1` - Major version

When Pull Requests are created:
- `pr-{number}` - Tag corresponding to PR number (e.g., `pr-42`)

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

## 🐳 Docker Local Execution

You can run it locally using Docker. Docker Compose is recommended for easier management.

### Environment Variables for Docker

| Variable Name | Required | Description |
|---------------|----------|-------------|
| `NOTION_TOKEN` | Required | Notion integration token |
| `NOTION_DATASOURCE_ID` | Required | Notion data_source ID |
| `NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID` | Optional | For Google Analytics plugin |
| `REVALIDATE_HOURS` | Optional | Revalidation interval in hours (default: 1) |
| `REVALIDATE_SECRET` | Optional | Token for revalidation API security — must match the `REVALIDATE_SECRET` GitHub Actions secret |
| `REDIS_URL` | Optional | Redis connection URL for L2 cache (e.g. `redis://localhost:6379`) |
| `ANTHROPIC_API_KEY` | Optional | Enables ontology entity/relation extraction for `/ontology`, graph semantic overlay, and RightRail `ai · similar` |
| `OPENAI_API_KEY` | Optional | Enables `text-embedding-3-small` embeddings stored in Qdrant for vector search |
| `QDRANT_URL` | Optional | Recommended for persisted graph snapshots; also used by ontology/vector search. `docker-compose.yml` sets `http://qdrant:6333` for the Compose `blog` service. If missing or unreachable, graph reads fall back to rebuild/cache without persisted snapshots. |
| `QDRANT_API_KEY` | Optional | API key for authenticated remote Qdrant; leave empty for local/self-hosted Qdrant |

### Create Environment Variable File

First, create a `.env` file:

```bash
NOTION_TOKEN=your_notion_token
NOTION_DATASOURCE_ID=your_notion_datasource_id
NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID=your_measurement_id  # Optional
REVALIDATE_HOURS=1
REVALIDATE_SECRET=your_random_string     # Generate a secure random string
REDIS_URL=redis://localhost:6379         # Optional — Redis connection for L2 cache
```
Optional ontology/vector search variables:

```bash
# Enables /ontology, Graph semantic overlay, RightRail ai · similar,
# and persisted graph snapshots in Qdrant
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
```

### Using docker-compose (Recommended)

Docker Compose provides an easy way to manage the container with automatic restart, health checks, and log persistence.

```bash
# Normal blog stack: blog + redis + qdrant
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down

# Rebuild and restart the stack
docker compose up -d --build
```

The docker-compose configuration includes:
- Automatic restart unless manually stopped
- Health checks for blog, Redis, and Qdrant
- Log persistence via volume (`logs-data`)
- Image cache persistence via volume (`image-cache`)
- Redis L2 cache persistence via volume (`redis-data`)
- Qdrant storage via volume (`qdrant-storage`), powering persisted graph snapshots plus `/ontology`, graph semantic overlay, and RightRail `ai · similar`
- Port mapping to 3000

### Running Docker Directly

```bash
# Run latest version
docker run -d -p 3000:3000 --env-file .env --restart unless-stopped ghcr.io/jung-geun/monolog:latest

# Run development version
docker run -d -p 3000:3000 --env-file .env --restart unless-stopped ghcr.io/jung-geun/monolog:dev

# Run nightly version
docker run -d -p 3000:3000 --env-file .env --restart unless-stopped ghcr.io/jung-geun/monolog:nightly
```

After running, you can check the blog at http://localhost:3000.

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

   A5: Make sure `NOTION_TOKEN` and `NOTION_DATASOURCE_ID` are correctly set in the `.env` file. For comments, use `NOTION_COMMENTS_DATASOURCE_ID` (the data_source ID, not the database ID). Also check Docker logs: `docker logs <container_id>` or `docker-compose logs -f`

   If you encounter other issues, feel free to register them in GitHub Issues. It helps other users too!

</details>

## 🤝 Contributing

Please check the [Contributing Guide](.github/CONTRIBUTING.md).

## 📄 License

This project follows the [MIT License](LICENSE).