# PLAN-system-fix.md

## Problem
Data (contacts, tasks, names) is not appearing in the UI due to a combination of:
1.  **Mock Mode Bug**: Backend was incorrectly falling back to Mock Mode even with valid credentials.
2.  **Port Conflict**: Packaged production processes (`mufyard-backend.exe`) were occupying port 8000, preventing the updated dev backend from starting.
3.  **Missing Logger**: Synchronization tasks were crashing due to undefined logger.

## Proposed Changes

### Phase 1: Infrastructure & Cleanup
- [x] Update `start.bat` to kill packaged processes (`mufyard-backend.exe`, etc.)
- [x] Kill existing conflicting processes manually.
- [x] Replace `firebase-credentials.json` with the latest key.

### Phase 2: Backend Logic Fixes
- [x] Fix `firebase_admin.py` initialization logic (done).
- [x] Define `logger` in `contact_service.py` and `inspector_service.py` (done).
- [ ] Add a health-check endpoint that reports if the backend is in Mock Mode or Real Mode.

### Phase 3: Verification
- [ ] Verify frontend connects to port 8000.
- [ ] Verify Firestore data is fetched correctly in the UI.

## Verification Checklist
- [ ] Backend log shows "Firebase Admin and Storage initialized successfully."
- [ ] `GET /api/contacts/` returns 171 records.
- [ ] UI displays contacts in the "Kurumsal Rehber" tab.
