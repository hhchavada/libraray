# AGENTS.md

## Learned User Preferences

- User communicates in Hinglish (Hindi + English mix); keep all code, commits, and file content in English — only conversational replies may be in Hinglish.

## Learned Workspace Facts

- **Stack**: Node.js + Express + TypeScript + MongoDB (Mongoose 8) B2B library management backend. All API routes are under `/api/v1`. MVC structure lives under `src/` (controllers, services, models, routes, validations, utils, constants).
- **Mongoose mutation pattern**: Before mutating a document and re-populating it, always fetch it with `{ populateSeat: false }` to avoid Mongoose internal `$populated` state interference. After mutations and saves, fetch a fresh copy from DB (e.g. `getMemberById(id)`) instead of calling `.populate()` on the same in-memory document.
- **Seat bookings response**: The `bookings` array in `GET /seats/:libraryId/all` must include both `_id` (MongoDB ObjectId — true database ID, usable in API calls) and `memberId` (display ID like "LIB-0002") for each booking entry. Including only `memberId` is insufficient.
- **generateMemberId limitation**: `generateMemberId` uses `countDocuments() + 1`, which can produce duplicate IDs when members are deleted. Do not rely on it for uniqueness guarantees.
- **formatMemberLabels side-effect**: `formatMemberLabels` always appends `email: ""` and `remarks: ""` even to plain objects; avoid applying it outside full member serialization contexts.
- **changeMemberSeat pattern**: `changeMemberSeat` (and all similar mutation flows) should use `getMemberById(id, { populateSeat: false })` — follow this same pattern for any fetch-mutate-save flow.
