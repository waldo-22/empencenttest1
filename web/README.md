# Empyrean Enclave — React Frontend

This folder contains a Vite + React frontend for Empyrean Enclave Entertainment. It can run standalone (localStorage) or talk to the existing Express API at `/api`.

Run locally from this folder:

```bash
cd web
npm install
npm run dev
```

Open the dev server URL (usually http://localhost:5173).

Notes:
- If the Express backend runs on the same host and port, the app will use it. If not, the app falls back to localStorage.
- To use the Express backend during development, run both servers and ensure CORS or proxying as needed.
