# AI Action Studio Updates

This public repository is the compatibility distribution endpoint for AI Action Studio Windows updates.

It intentionally contains only public release artifacts required by existing desktop clients:

- stable and historical update manifests (`latest*.json`)
- immutable update packages under `updates/`
- release SHA-256 checksum files under `release/*/SHA256.txt`

Application source code, PWA implementation, CI/CD workflows, database migrations, and internal release tooling are maintained separately and are not published here.

Historical `AIArticleStudio` package names and paths are preserved for backward compatibility with existing clients. Do not rename or remove published update artifacts.
