# Contributing

When contributing to this repository, please first discuss the change you wish to make via issue, email, or any other method with the owners of this repository before making a change.
Please note we have a [code of conduct](CODE_OF_CONDUCT.md), please follow it in all your interactions with the project.

## Development environment setup

Tablog is a read-only VS Code-themed Notion blog. Start with the [README](../README.en.md), [architecture and development reference](../project.md), [design reference](../DESIGN.md), [feature reference](../docs/FEATURES.md), and [operator guide](../docs/USAGE.md). The product name is separate from the personal site title and domain configured by its operator.

Use Node.js 22 or 24 LTS and **Yarn Classic 1.22.22**, as declared in `package.json`. CI and the web Dockerfile use Node.js 22. If Yarn is unavailable, enable Corepack and run `corepack install` inside the cloned repository; distributions without Corepack need Yarn 1.22.22 installed separately. Keep `yarn.lock` as the only package-manager lockfile; do not introduce npm, pnpm, or Bun lockfiles.

```sh
git clone https://github.com/jung-geun/tablog.git
cd tablog
yarn install --frozen-lockfile
cp -n .env.example .env
chmod 600 .env
# Fill only NOTION_TOKEN and NOTION_DATASOURCE_ID in .env initially.
# The latter accepts a data-source UUID or the original Notion database URL.
yarn setup
yarn dev
```

Open `http://localhost:3000`. Share the original database with the integration first; linked views and view IDs are not data-source IDs. See [Notion setup](../docs/USAGE.md#notion-셋업) for the template and permissions. `yarn setup` takes no arguments, reads only the repository-root `.env` (not shell overrides), resolves a database URL, and generates `REVALIDATE_SECRET` when blank. It preserves existing secrets and unrelated settings, restricts permissions to `0600`, and generates independent salts only when the corresponding optional DB IDs are configured. For multiple data sources, select the explicit UUID reported by setup and rerun it. Never commit `.env`, tokens, salts, or private data.

Native development uses `CONTENT_STATE_DIR=.content-state` from `.env.example`; it does not require Redis, Qdrant, an embedding service, or an Anthropic key to read articles. Meaning search and similar posts require the embedding service, Qdrant, and current document vectors; Anthropic is only for ontology entity/relation extraction. Notion comments, visitor statistics, Utterances, analytics, verification, ads, and outbound notifications are optional. The current image-proxy rate limiter also requires `COMMENT_HASH_SALT` even with comments disabled; see the [image-proxy prerequisite](../docs/USAGE.md#이미지-프록시) before relying on thumbnails.

### Quality commands

```sh
yarn type-check
yarn lint
yarn test                # Unit suite; same selection as yarn test:unit
yarn test:watch          # Unit watch mode
yarn test:coverage       # Unit coverage
yarn build              # Production webpack build; not an integration test
```

`yarn dev` and `yarn build` explicitly use webpack. `yarn start` serves an existing production build. Run the checks relevant to your change and report the commands and results in the PR; do not describe a skipped test as coverage. The Test Suite workflow runs unit tests and a separate build on Node.js 22; its lint and type-check steps currently use `continue-on-error`, so a green workflow does not establish that either check was clean.

Live Notion tests are **opt-in**, separate from `yarn test`:

```sh
yarn test:integration   # Real Notion API requests, not isolated fixtures
yarn test:all           # Unit suite, then live integration suite
yarn test:coverage:all  # Unit coverage, then live integration coverage
```

Integration tests load local environment settings and skip when their required credentials are absent. Provide an authorized test database, durable content storage, and the fixtures the selected test expects: the image test uses `NOTION_TEST_POST_TITLE` (default `test post`), the table test scans recent pages for a real table, and the color test currently addresses a fixed page ID. The slug test reads the configured content source and exercises fresh retrieval. Missing fixtures can skip assertions or fail; a credential-free run is not a successful live integration check. Do not point these commands at an unrelated or private production database, print its contents in PR logs, or run them merely because credentials happen to exist in `.env`.

### Source settings and runtime settings

- Edit `site.config.js` for profile, projects, language/timezone, theme defaults, and source-controlled integrations; rebuild production images after source changes.
- Set the public origin, AdSense policy/slots, Utterances repository, Notion comment UI flag, and `REVALIDATE_HOURS` **before building**. Restarting an existing image does not change those compiled values. Keep server-only Notion credentials and secrets out of build arguments and repository variables.
- Only Analytics and Google/Naver/Bing verification values have the container's explicit public runtime-config path. Recreate the container after changing its environment; `docker compose restart` does not reload an edited `.env`.
- Article translation depends on a secure-context browser exposing the built-in Translator API and supporting the selected language pair. Opening its panel only checks availability; the explicit **Translate article** gesture starts model preparation and translation. There is no cloud translation fallback.
- Ads fail closed: a publisher ID alone is insufficient. Auto mode requires account-side in-page/text-ad-intent restrictions and their confirmation; manual mode requires account Auto ads OFF, its confirmation, and a real display unit ID. These build-time flags do not configure Google or prove ad fill. Follow the [full ad policy](../docs/USAGE.md#광고와-작업-공간-경계).

### Docker and persistent data

Docker Compose runs the production stack, not a hot-reloading development server. After setup and choosing your deployment origin:

```sh
docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 2400
docker compose ps
docker compose logs -f blog embedding
```

Only the web port `3000` is exposed by the base Compose stack. The stack includes cache Redis, a separate AOF-backed content Redis, Qdrant, and a private CPU embedding service. Its declared embedding platform is `linux/amd64`; ARM hosts need emulation support. Initial model download/inference and Notion bootstrap take time. Check `/api/init` results in the blog logs, then run the documented content maintenance job for embedding backfill; a healthy homepage or initialized routes do not establish complete semantic indexing.

Source builds are the default and need no authentication to the project's GHCR packages. Before using a prebuilt image, verify the exact published tag and package access. A GitHub repository redirect is not a GHCR package alias. Do not change an existing deployment's image pin merely to match the new repository name.

For an existing installation, preserve its original Compose project name **before any Compose command from a moved checkout**, along with overrides, mounts, namespaces, and all data volumes. Existing `monolog` cookies/storage/proxy headers/cache identifiers remain intentional. **Do not run `docker compose down -v` as an update or rename step:** it removes this Compose project's named volumes, including durable content, Qdrant data, and model cache. Follow [migration and backup guidance](../docs/USAGE.md#기존-설치의-이름-변경) instead.



### Commit message rules

Consider following the below format for the commit message:

Commit Type : `feat|fix|perf|refactor|test|ci|docs|build|chore`

**Examples**

- `feat`: introduce a user-visible capability.
- `fix`: correct a behavior or boundary bug.
- `docs`: update instructions, references, or example images.

## Issues and feature requests

You've found a bug in the source code, a mistake in the documentation or maybe you'd like a new feature? You can help us by [submitting an issue on GitHub](https://github.com/jung-geun/tablog/issues). Before you create an issue, make sure to search the issue archive -- your issue may have already been addressed!

Please try to create bug reports that are:

- _Reproducible._ Include steps to reproduce the problem.
- _Specific._ Include as much detail as possible: which version, what environment, etc.
- _Unique._ Do not duplicate existing opened issues.
- _Scoped to a Single Bug._ One bug per report.

For feature requests, [open an issue](https://github.com/jung-geun/tablog/issues) describing the reader or operator problem, the desired outcome, and any relevant examples. Search existing issues and pull requests first so related proposals stay together.

**Even better: Submit a pull request with a fix or new feature!**

### How to submit a Pull Request

1. Search our repository for open or closed [Pull Requests](https://github.com/jung-geun/tablog/pulls) that relate to your submission. You don't want to duplicate effort.
2. Fork the project.
3. Create your feature branch (`git checkout -b feat/amazing_feature`).
4. Commit your changes (`git commit -m 'feat: add amazing_feature'`). Please follow the specification mentioned above for your commit messages.
5. Push to the branch (`git push origin feat/amazing_feature`).
6. [Open a Pull Request](https://github.com/jung-geun/tablog/compare?expand=1).
7. Make sure to fill in the all the details in the Pull Request to make it easier for the reviewers. Make sure to refer to any discussion or Issues that your PR is fixing.
