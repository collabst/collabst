# Frontend Setup & Testing Guide

## Complete Application Flow

### 1. Start the Backend

```bash
cd backend
docker-compose up -d
uv run alembic upgrade head
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Make sure you created a .env based on .env.example
Backend will be at: http://localhost:8000

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```
Make sure your .env has the correct port for the backend (e.g 8000)

Frontend will be at: http://localhost:5173

## Testing the Complete Flow

### Step 1: Register an Account

1. Open http://localhost:5173
2. Click "Register"
3. Enter:
   - Email: `test@example.com`
   - Username: `testuser`
   - Password: `password123`
4. Click "Register"
5. You'll be auto-logged in and redirected to Projects

### Step 2: Create a Project

1. Click "+ New Project"
2. Enter:
   - Name: `My First Typst Project`
   - Description: `Learning Typst collaboration`
3. Click "Create Project"
4. You'll see the project card appear

### Step 3: Open the Editor

1. Click "Open" on your project
2. You'll enter the editor interface

### Step 4: Create a File

1. Click the "+" button in the left sidebar
2. Enter filename: `main.typ`
3. Click "Create"
4. The file will open in the editor

### Step 5: Start Editing

1. Type some Typst code:
   ```typst
   #heading[Hello Typst]

   This is my first collaborative document.

   #list[
     - Real-time sync
     - Multiple users
     - No conflicts
   ]
   ```

2. Watch the connection status (should be green "Connected")
3. Click "Save" to persist to database

### Step 6: Test Real-Time Collaboration

#### Option A: Two Browser Windows

1. **Window 1**: Keep your current session open
2. **Window 2**: Open incognito/private mode
3. Go to http://localhost:5173
4. Login with the same account
5. Open the same project
6. Open the same file

Now type in Window 1 and watch it appear in Window 2 instantly!

#### Option B: Two Different Users

1. **Browser 1**: Already logged in
2. **Browser 2** (incognito): Register a different account
3. **Browser 1**: Add the new user as collaborator (see Step 7)
4. **Browser 2**: Open the shared project
5. Both users can edit simultaneously!

### Step 7: Add Collaborators (if implemented)

1. In the editor, click "👥 Collaborators"
2. See online users in real-time
3. Each user has a unique color

## What to Look For

### ✅ Connection Status

Top center of editor:
- 🟢 Connected = WebSocket active
- ✓ Synced = Document synced
- 🔴 Disconnected = Check backend/network

### ✅ Real-Time Sync

- Type in one window → appears in other
- No lag (should be instant)
- Cursor positions (if implemented)
- No conflicts when editing same line

### ✅ Persistence

- Click "Save" → data goes to PostgreSQL
- Reload page → content persists
- YJS handles real-time, DB handles long-term

## Troubleshooting

### Backend Not Responding

```bash
# Check backend is running
curl http://reva-dl:8002/

# Should return: {"message":"Typst Collaboration Platform API","version":"0.1.0"}
```

### WebSocket Not Connecting

1. Check `.env` file has correct `VITE_WS_URL`
2. Look at browser console for errors
3. Check Network tab for WebSocket connection
4. Verify backend WebSocket endpoint is accessible

### CORS Errors

Backend `.env` should include:
```
CORS_ORIGINS=["http://localhost:5173"]
```

### Authentication Issues

1. Check localStorage has `token` after login
2. Try logout and login again
3. Clear browser storage and re-register

## Development Tips

### Hot Reload

Both frontend and backend support hot reload:
- Frontend: Vite HMR (instant updates)
- Backend: `--reload` flag (restarts on changes)

### DevTools

**Browser DevTools**:
- Console: See YJS updates and errors
- Network: Monitor WebSocket messages
- Application > LocalStorage: See auth token

**React DevTools**:
Install extension to inspect React components and state

### API Testing

Use the interactive docs at http://reva-dl:8002/docs

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Browser Window 1                   │
│  ┌────────────┐         ┌────────────────────────┐ │
│  │  React UI  │◄───────►│  YJS Document (CRDT)   │ │
│  └────────────┘         └───────────┬────────────┘ │
│                                     │               │
│                                     │ WebSocket     │
└─────────────────────────────────────┼───────────────┘
                                      │
                                      ▼
                        ┌─────────────────────────┐
                        │   FastAPI Backend       │
                        │   - REST API            │
                        │   - WebSocket Server    │
                        │   - YJS Broadcast       │
                        └────┬──────────┬─────────┘
                             │          │
                    ┌────────▼──┐  ┌───▼──────┐
                    │PostgreSQL │  │  Redis   │
                    │  (Files)  │  │ (State)  │
                    └───────────┘  └──────────┘
                                      │
                                      ▲
                                      │ WebSocket
┌─────────────────────────────────────┼───────────────┐
│                                     │               │
│                                     │               │
│  ┌────────────┐         ┌───────────┴────────────┐ │
│  │  React UI  │◄───────►│  YJS Document (CRDT)   │ │
│  └────────────┘         └────────────────────────┘ │
│                   Browser Window 2                   │
└─────────────────────────────────────────────────────┘
```

## Files Created

```
frontend_dev/
├── src/
│   ├── components/
│   │   └── CodeEditor.tsx          # CodeMirror + YJS
│   ├── context/
│   │   └── AuthContext.tsx         # Authentication
│   ├── hooks/
│   │   └── useYjs.ts               # YJS WebSocket
│   ├── pages/
│   │   ├── Login.tsx               # Login page
│   │   ├── Register.tsx            # Register page
│   │   ├── Projects.tsx            # Project list
│   │   └── Editor.tsx              # Collaborative editor
│   ├── services/
│   │   └── api.ts                  # API client
│   ├── types/
│   │   └── index.ts                # TypeScript types
│   ├── App.tsx                     # Main app
│   └── main.tsx                    # Entry point
├── .env                            # Configuration
└── README.md                       # Documentation
```

## Next Steps

1. ✅ Test authentication
2. ✅ Create projects
3. ✅ Create files
4. ✅ Test real-time collaboration
5. 🚀 Add more features (see README)

## Success Criteria

You've successfully set up the frontend if:

✅ You can register and login
✅ You can create projects
✅ You can create files
✅ You can edit files in the CodeMirror editor
✅ Changes sync in real-time across browser windows
✅ Connection status shows "Connected"
✅ Files persist after refresh

Enjoy building with Typst! 🚀
