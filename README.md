# Hakboni

Korean and Taiwan cheerleader news desk.

## Open locally

Open `index.html` in a browser.

## GitHub Pages

This site is static. After pushing this folder to a GitHub repository, enable GitHub Pages from the repository settings and publish from the `main` branch root.

## Cloud newsroom check

GitHub Actions runs `.github/workflows/hakboni-newsroom-check.yml` every 15 minutes and on manual dispatch. It scans recent Korean and Taiwan professional-news candidates, writes a workflow summary, and opens a GitHub issue labeled `newsroom-check` when candidates are found.

The workflow does not publish stories automatically. Nash still verifies title, URL, date, summary, image metadata, crop quality, and editorial fit before any site update.
