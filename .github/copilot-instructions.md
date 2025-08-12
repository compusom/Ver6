# Copilot Instructions for Ver6

## Big Picture Architecture
- **Monorepo:** Contains both frontend (React) and backend (Node.js/Express) in a single workspace. Key files: `App.tsx`, `server.js`, `components/`, `lib/`, `database.ts`.
- **Frontend:** Uses React with modular components in `components/`. Data source switching and routing handled via `DataSourceProvider` and context in `App.tsx`.
- **Backend:** Express server (`server.js`) provides REST APIs, handles SQLite and SQL Server connections, and manages import flows for Meta/Looker XLSX files.
- **Data Flow:** Frontend calls backend endpoints for data import, client management, and performance analytics. SQL import logic includes client existence checks and upsert logic.

## Developer Workflows
- **Start Both Frontend & Backend:** Always use `npm run start` to launch both together. This frees ports and ensures all features (especially SQL) work.
- **Build Number:** Manually increment `BUILD_NUMBER` in `build-info.ts` with every code change. This is visible in the app header.
- **Meta Import Testing:** Use provided XLSX files in `components/archivos demo/` for import validation. Re-importing should not create duplicates due to unique indices.
- **Environment Variables:** Set `GEMINI_API_KEY` in `.env.local` for Gemini API features.

## Project-Specific Patterns & Conventions
- **Client Existence Confirmation:** On Meta import, backend checks for normalized client name. If not found, responds 409 for frontend confirmation before creation.
- **Upsert Logic:** SQL import uses MERGE statements to avoid duplicates and update existing records.
- **Data Routing:** All data fetches and mutations are routed through context providers and backend APIs.
- **Build Versioning:** The build version is displayed in the app header and must be updated in `build-info.ts` on every code change.

## Integration Points & Dependencies
- **External APIs:** Gemini API (Google GenAI) for creative analysis. Requires API key.
- **Database:** SQLite for local, SQL Server for remote. Switching handled via context/provider.
- **File Uploads:** XLSX import logic in backend (`server.js`) and frontend (`ImportView.tsx`).
- **Unique Indices:** SQL tables use unique indices to prevent duplicate metric imports.

## Key Files & Directories
- `App.tsx`: Main React app, data source switch, header with build version.
- `server.js`: Express backend, SQL/SQLite logic, import endpoints.
- `components/`: All React UI components.
- `lib/`: Data processing, connectors, and utility logic.
- `build-info.ts`: Build number for versioning.
- `components/archivos demo/`: Demo XLSX files for import testing.
- `.env.local`: Environment variables (API keys).

## Example Patterns
- **Meta Import Flow:**
  - Frontend uploads XLSX → Backend checks client → Responds 409 if not found → Frontend confirms → Backend creates client and imports metrics.
- **Build Number Update:**
  - Edit `build-info.ts`, increment `BUILD_NUMBER`, commit with code changes.

---

If any section is unclear or missing, please specify what needs improvement or what additional context is required for AI agents to be productive in this codebase.
