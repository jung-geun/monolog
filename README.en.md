# MoreThanLog (Improved Fork Version)

> This project is an improved fork based on the original [morethan-log](https://github.com/morethanmin/morethan-log) project. We deeply appreciate the excellent work of the original developer, and have implemented additional features on top of that foundation.

**Original Project**: [morethan-log](https://github.com/morethanmin/morethan-log) by [morethanmin](https://github.com/morethanmin)

[Demo Blog](https://morethan-log.vercel.app) | [Demo Resume](https://morethan-log.vercel.app/resume)

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

### 👀 SEO Friendly
- Dynamic OG image (thumbnail) generation for posts ([og-image-korean](https://github.com/morethanmin/og-image-korean))
- Dynamic sitemap generation for posts

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
2. [Fork](https://github.com/jung-geun/morethan-log/fork) to your profile.
3. Duplicate the [Notion template](https://pieroot.notion.site/307067c015d080d987eadd99c8369f92?v=307067c015d0817a87a8000c109eb446&source=copy_link) and enable "Share to web".
4. Copy the web link and note the Notion Page ID. Link format: `[username.notion.site/NOTION_PAGE_ID?v=VERSION_ID]`
5. Clone the forked repository and customize `site.config.js` as desired.
6. Choose one of the deployment methods below.

### Environment Variables for Vercel Deployment

| Variable Name | Required | Description |
|---------------|----------|-------------|
| `NOTION_PAGE_ID` | Required | Notion page ID extracted from "Share to web" URL |
| `NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID` | Optional | For Google Analytics plugin |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Optional | For Google Search Console plugin |
| `NEXT_PUBLIC_NAVER_SITE_VERIFICATION` | Optional | For Naver Search Advisor plugin |
| `NEXT_PUBLIC_UTTERANCES_REPO` | Optional | For Utterances plugin |

## ☁️ Vercel Deployment Method

### Quick Deploy (10-Step Guide)

<details>
   <summary>View Step-by-Step Guide</summary>

   0. Prepare Notion and Vercel accounts.

   1. ⭐ `Star` and `Fork` this repository.

   2. Click the [Notion template](https://quasar-season-ed5.notion.site/12c38b5f459d4eb9a759f92fba6cea36?v=2e7962408e3842b2a1a801bf3546edda) to open the Notion page in your browser. Click the `Duplicate` button in the top right corner.

   3. You can check your Notion page in your account in the Notion app.

   4. Click `Share` and `Publish` in the top right corner and check the web link. (Copy web link)

   5. `Modify` the **site.config.js** file in the forked repository.

   6. Log in to Vercel.

   7. `Create` a new project using **Add New...**.

   8. `Import` the forked morethan-log repository.

   9. `Add` environment variables to the Vercel project.

   10. `Wait` for deployment to complete. When deployment is successful, you'll see a screen like below.

   🥳 Congratulations! Now check out your blog!

</details>

## 🐳 Docker Local Execution

You can run it locally using Docker. Docker Compose is recommended for easier management.

### Environment Variables for Docker

| Variable Name | Required | Description |
|---------------|----------|-------------|
| `NOTION_TOKEN` | Required | Notion integration token |
| `NOTION_DATASOURCE_ID` | Required | Notion database ID |
| `NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID` | Optional | For Google Analytics plugin |
| `REVALIDATE_HOURS` | Optional | Revalidation interval in hours (default: 1) |
| `TOKEN_FOR_REVALIDATE` | Optional | Random string for revalidation API security |

### Create Environment Variable File

First, create a `.env` file:

```bash
NOTION_TOKEN=your_notion_token
NOTION_DATASOURCE_ID=your_notion_datasource_id
NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID=your_measurement_id  # Optional
REVALIDATE_HOURS=1
TOKEN_FOR_REVALIDATE=your_random_string  # Generate a secure random string
```

### Using docker-compose (Recommended)

Docker Compose provides an easy way to manage the container with automatic restart, health checks, and log persistence.

```bash
# Run in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild and restart (after configuration changes)
docker-compose up -d --build
```

The docker-compose configuration includes:
- Automatic restart unless manually stopped
- Health check every 30 seconds
- Log persistence via volume (`logs-data`)
- Port mapping to 3000

### Running Docker Directly

```bash
# Run latest version
docker run -d -p 3000:3000 --env-file .env --restart unless-stopped ghcr.io/jung-geun/morethan-log:latest

# Run development version
docker run -d -p 3000:3000 --env-file .env --restart unless-stopped ghcr.io/jung-geun/morethan-log:dev

# Run nightly version
docker run -d -p 3000:3000 --env-file .env --restart unless-stopped ghcr.io/jung-geun/morethan-log:nightly
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

   A4: Refer to https://github.com/morethanmin/morethan-log/issues/203. It may take some time for updates to be reflected after configuration.

   **Q5: The Docker container won't run.**

   A5: Make sure `NOTION_TOKEN` and `NOTION_DATASOURCE_ID` are correctly set in the `.env` file. Also check Docker logs to identify specific error messages: `docker logs <container_id>` or `docker-compose logs -f`

   If you encounter other issues, feel free to register them in GitHub Issues. It helps other users too!

</details>

## 🤝 Contributing

Please check the [Contributing Guide](.github/CONTRIBUTING.md).

## 📄 License

This project follows the [MIT License](LICENSE).