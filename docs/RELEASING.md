# Releasing

How `health-mcp` gets a version bump, a git tag, an npm release, and moving GHCR tags — all from one GitHub Actions run, with no long-lived publish secrets.

## What a release does

A release is cut by running the **Release** workflow ([`.github/workflows/release.yml`](../.github/workflows/release.yml)) from the Actions tab. One run, in order:

1. Installs, then runs `lint → build → typecheck → test`. A red gate stops the release.
2. Bumps `apps/server/package.json` by the bump level you pick (`patch` / `minor` / `major`).
3. Refuses to continue if that version already exists as a git tag or on npm.
4. Commits the bump and pushes the commit + `vX.Y.Z` tag to `main` atomically.
5. Builds and pushes the image to GHCR: `:X.Y.Z`, `:X.Y`, and `:latest` (skipped for pre-releases), with a provenance attestation.
6. Publishes `health-mcp@X.Y.Z` to npm over OIDC trusted publishing, with provenance.
7. Creates a GitHub Release with generated notes.

The version is single-sourced from `apps/server/package.json` — the git tag, the npm version, the image tag, and the server's own `/version` / `--version` output all read from it.

The rolling `:main` and `:sha-<commit>` images come from a separate workflow ([`docker-publish.yml`](../.github/workflows/docker-publish.yml)) on every push to `main`. Releases never touch those tags, and that workflow never produces version tags.

## One-time setup

`health-mcp` already exists on npm, so there's no token bootstrap. Two things need configuring once.

### 1. npm trusted publisher

On [npmjs.com → health-mcp → Settings](https://www.npmjs.com/package/health-mcp/access), add a trusted publisher. All fields are **case-sensitive and exact**:

| Field | Value |
| --- | --- |
| Publisher | GitHub Actions |
| Organization or user | `lukaisailovic` |
| Repository | `health-mcp` |
| Workflow filename | `release.yml` |
| Environment name | `release` |

> Renaming `release.yml` breaks publishing until this entry is updated to match.

Once it works you can optionally turn on "Require two-factor authentication and disallow tokens" on the package — trusted publishing keeps working, only classic tokens stop.

### 2. GitHub environment

The workflow runs in a `release` environment. GitHub creates it on the first run; add required reviewers under Settings → Environments → `release` if you want a manual approval gate before anything publishes.

### Branch protection

Step 4 pushes the bump commit to `main`. If `main` is protected, allow `github-actions[bot]` to bypass the pull-request requirement (Settings → Branches), or the push — and the release — will fail before anything is published.

## Cutting a release

1. Actions → **Release** → **Run workflow**.
2. Branch: `main`. Bump: `patch` / `minor` / `major`.
3. Optional: tick **dry_run** first. It runs the full gate, builds the image, and packs the npm tarball, but pushes and publishes nothing.
4. Run it.

That's the whole "bump → tag → publish" flow. No local `npm version`, no `git push --tags`.

## What ships

- **npm**: `health-mcp@X.Y.Z`, public, with a provenance statement linking it to this repo and workflow run.
- **GHCR**: `ghcr.io/lukaisailovic/health-mcp` at `:X.Y.Z`, `:X.Y`, and `:latest`, with a provenance attestation.
- **git / GitHub**: a `chore(release)` commit on `main`, a `vX.Y.Z` tag, and a GitHub Release.

## Security model

- **No publish secrets.** npm auth is OIDC trusted publishing — pnpm mints a short-lived token from the run's `id-token`. GHCR uses the run's `GITHUB_TOKEN`. There is no `NPM_TOKEN` in the repo.
- **Forks can't publish.** CI runs on `pull_request` with a read-only token and no secrets. `release.yml` and `docker-publish.yml` only trigger on maintainer dispatch or pushes to `main`, never on pull requests, so a fork PR can't reach the registry or npm.
- **Pinned actions.** Every third-party action is pinned to a full commit SHA; Dependabot ([`dependabot.yml`](../.github/dependabot.yml)) raises a weekly grouped PR to keep them current.
- **Least privilege.** Workflows default to `contents: read`; the release job elevates only the scopes it needs.
- **Workflows are linted.** Every PR runs `actionlint` and `zizmor` over `.github/workflows`, so changes to the CI/CD itself are checked for syntax and security regressions.

## Recovery

The preflight check makes the common footgun — re-running a release for a version that already shipped — fail fast with a clear message.

If a run dies after the tag push but before npm/docker finish, the tag exists, so a re-run aborts on preflight. Either finish that version by hand, or delete the tag and revert the bump commit, then re-dispatch:

```bash
git push origin :refs/tags/vX.Y.Z
git revert <bump-commit>   # or reset main if nothing else landed
```

Use **dry_run** to rehearse the pipeline end to end whenever you're unsure.
