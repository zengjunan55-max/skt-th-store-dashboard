# Refresh Button Setup

This project now supports triggering a GitHub Actions refresh from the online dashboard button.

## Files added

- `.github/workflows/refresh-dashboard.yml`
- `functions/api/refresh.js`

## How it works

1. The dashboard button sends a `POST` request to `/api/refresh`.
2. The Cloudflare Pages Function calls the GitHub Actions `workflow_dispatch` API.
3. GitHub Actions runs `tools/build_deploy_data.py`.
4. The workflow commits refreshed data files to `main`.
5. Cloudflare Pages redeploys the updated site automatically.

## Cloudflare Pages environment variables

Open the Cloudflare Pages project for this site and add these variables:

- `GITHUB_TOKEN`
  - A GitHub token that can trigger workflows for this repository.
  - Recommended permissions for a fine-grained token:
    - `Actions: Read and write`
    - `Contents: Read and write`
- `GITHUB_OWNER`
  - Value: `zengjunan55-max`
- `GITHUB_REPO`
  - Value: `skt-th-store-dashboard`
- `GITHUB_WORKFLOW_ID`
  - Value: `refresh-dashboard.yml`
- `GITHUB_REF`
  - Value: `main`

After adding variables, redeploy the Cloudflare Pages project once.

## Notes

- The online refresh button is now a cloud trigger, not a local script runner.
- If a refresh workflow is already running, the API returns `刷新进行中`.
- The dashboard data changes appear only after the GitHub Actions run finishes and Cloudflare Pages completes deployment.
