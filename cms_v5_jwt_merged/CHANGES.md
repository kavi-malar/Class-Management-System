# CMS Upgrade — Classroom Number Feature + Recommendations

## What Changed in This Version

### 1. Classroom Number (Room No.) — Core Feature

**Backend**
- `models/FixedTimetable.js` — Added `classroomNo` (default: "TBD"), `classroomUpdatedBy`, `classroomUpdatedAt` fields.
- `models/TimetableChange.js` — Added optional `classroomNo` override field (overrides fixed room for a specific date).
- `controllers/timetableController.js` — Added `PATCH /api/timetable/:id/classroom` endpoint.
  - **Teacher**: can only update their own assigned period's room.
  - **CR**: can update any period's room.
  - **Student**: read-only (no access to this endpoint).
- `routes/timetableRoutes.js` — Registered new PATCH route with `authorize('teacher', 'cr')` guard.
- `services/smsService.js` — Added `notifyStudentsAboutClassroomChange()` — sends SMS to all students when room changes.
- Daily reminder SMS now includes room number for each period.

**Frontend**
- `models/index.ts` — Updated `TimetableEntry` and `TimetableChange` interfaces with `classroomNo` fields.
- `services/timetable.service.ts` — Added `updateClassroomNo(entryId, classroomNo)` method.
- `components/student/timetable/` — **Room** column added to weekly view. Date view shows effective room (with change override support).
- `components/teacher/timetable/` — Room column with **inline edit button** (✏️) for own periods only. Saves via API + shows toast.
- `components/cr/timetable/cr-timetable.component.ts` — **NEW** — Full timetable view for CR. Can edit ANY period's room.
- `app.routes.ts` — Added `/cr/timetable` route.
- CR Dashboard navbar — Added Timetable link.

---

## Recommended Next-Level Upgrades

### A. Push Notifications (Web / Mobile)
Replace SMS-only with **browser push notifications** (PWA) using Firebase Cloud Messaging.
- Students get instant bell notifications without SMS cost.
- Works offline too.
- `npm install firebase` → set up FCM in frontend + store device tokens in User model.

### B. CR Announcement Board
A dedicated page where CR can post one-time announcements (lab change, holiday, event).
- New `Announcement` model in backend.
- Students see a feed on their dashboard.
- Optionally SMS-notify on important announcements.

### C. Smart Substitute Suggestion
When a teacher marks unavailable, auto-suggest available teachers (who have a free period at that slot).
- Query `FixedTimetable` for free slots → cross-reference `TimetableChange` for that date.
- CR/Teacher can one-click assign substitute.
- Substitute gets notified via SMS.

### D. Attendance Integration
Add a simple attendance model — teacher marks present/absent per period.
- CR sees a live attendance count per period.
- Students see their own attendance percentage.
- Warnings when attendance < 75%.

### E. Timetable History / Audit Log
Track every classroom number change with who changed it and when.
- Already partially done (`classroomUpdatedBy`, `classroomUpdatedAt`).
- Add a `/api/timetable/audit` endpoint.
- CR can view the full history of changes.

### F. Holiday / No-Class Day Management
CR or Teacher marks a full day as holiday.
- All students notified via SMS.
- Timetable view shows "No Classes" for that date.

### G. Student Timetable Personalisation
Students can pin/favourite specific periods (their most important classes).
- Get extra reminder SMS 30 min before those classes.

### H. WhatsApp Bot Integration
Use Twilio WhatsApp + a simple bot to let students query:
- "Today's timetable?"
- "Is Period 3 cancelled today?"
- Bot replies with live data from the API.

---

## How to Run

```bash
# Backend
cd backend
npm install
cp .env.example .env   # fill in MONGO_URI, JWT_SECRET, SMS_MODE
npm start

# Frontend
cd frontend
npm install
ng serve
```

Access: http://localhost:4200
