# Typst Preview Library

## Overview

This directory contains the Typst preview renderer built from the [tinymist](https://github.com/Myriad-Dreamin/tinymist) project. The preview is provided as a self-contained HTML file that renders Typst documents in the browser.

## When to Update

Update the preview library when:
- A new version of tinymist is released with preview improvements
- Bug fixes are needed in the preview functionality
- New Typst features need to be supported

## Update Instructions

### 1. Clone the tinymist Repository

```shell
cd /tmp
git clone https://github.com/Myriad-Dreamin/tinymist.git
cd tinymist/tools/typst-preview-frontend
```

### 2. Fix Package Configuration (If Needed)

**Note:** tinymist currently uses a deprecated `package.json` format. If you encounter errors during installation, update the dependencies in `package.json`:

```json
{
    "dependencies": {
        "typst-dom": "file:../typst-dom"
    }
}
```

> If tinymist has been updated to use the new format, skip this step and submit a PR to remove this note.

### 3. Build the Preview

```shell
npm install
npm install vite vite-plugin-singlefile
npx vite build
```

### 4. Copy the Built File

Copy the generated file from:
```
/tmp/tinymist/tools/typst-preview-frontend/dist/index.html
```

To this location in the repository:
```
frontend/src/lib/preview/index.html
```

### 5. Cleanup

```shell
rm -rf /tmp/tinymist
```

## Important Notes

- **DO NOT manually edit `index.html`** - It's a generated file that will be overwritten on the next update
- All customizations should be implemented via:
  - Injected scripts in our codebase
  - Contributions to the upstream tinymist project
- Always run CI checks before submitting a PR with preview updates

## Contributing

When submitting PRs that update the preview library:
1. Describe which tinymist version you built from
2. List any notable changes or fixes included
3. Ensure all CI checks pass
4. Test the preview functionality locally first
