# Typst Collaboration Platform - Frontend

Real-time collaborative Typst editor with React + TypeScript + YJS

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Features

✅ Authentication (register/login)
✅ Project management
✅ Real-time collaboration with YJS
✅ CodeMirror 6 editor
✅ Online presence
✅ Auto-sync

## Configuration

Edit `.env`:
```
VITE_API_URL=http://reva-dl:8002
VITE_WS_URL=ws://reva-dl:8002
```

## Test Collaboration

1. Open project in two browser windows
2. Edit in one window
3. See changes in the other instantly!
