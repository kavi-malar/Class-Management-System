# 📚 Integrated Class Management System with SMS Alerts

Full-stack web app: Angular + Node.js + MongoDB + Twilio SMS

---

## 🚀 Quick Start (Windows)

```bat
:: Terminal 1 — Backend
cd backend
npm install
npm run seed
npm run dev

:: Terminal 2 — Frontend
cd frontend
npm install
ng serve
```

Open browser: **http://localhost:4200**

---

## 📱 SMS Setup (Twilio)

### Step 1 — Get Twilio credentials
1. Sign up free at https://www.twilio.com
2. Go to **Console Dashboard**
3. Copy your **Account SID** and **Auth Token**
4. Click **Get a Trial Number** to get a free phone number

### Step 2 — Update backend/.env
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx   ← your SID
TWILIO_AUTH_TOKEN=your_auth_token_here              ← your token
TWILIO_PHONE_NUMBER=+1234567890                     ← your Twilio number
```

### Step 3 — Add student phone numbers
In `backend/utils/seedData.js`, update the `students` array with real phone numbers:
```js
{ name: 'Rahul Verma', phone: '+919XXXXXXXXXX', ... }
```
Then re-run: `npm run seed`

### Step 4 — Restart server
```bat
npm run dev
```

> ⚠️ **Without Twilio**: SMS messages are printed to the terminal (mock mode).
> The app works fully — just no real SMS sent to phones.

---

## 🔑 Login Credentials

| Role    | Email                | Password     | Subject     |
|---------|----------------------|--------------|-------------|
| Teacher | arjun@school.edu     | teacher123   | Mathematics |
| Teacher | priya@school.edu     | teacher123   | Physics     |
| Teacher | rajan@school.edu     | teacher123   | Chemistry   |
| Teacher | sneha@school.edu     | teacher123   | English     |
| Teacher | vikram@school.edu    | teacher123   | Comp. Sci   |
| Student | rahul@student.edu    | student123   | —           |
| Student | anjali@student.edu   | student123   | —           |
| Student | mohan@student.edu    | student123   | —           |

---

## 🗓️ Timetable Structure

8 periods per day. Each teacher has 2–3 assigned periods — rest are FREE.

| Day       | P1   | P2   | P3   | P4   | P5   | P6  | P7   | P8  |
|-----------|------|------|------|------|------|-----|------|-----|
| Monday    | MATH | PHY  | CHEM | ENG  | FREE | CS  | FREE | BIO |
| Tuesday   | ENG  | FREE | HIST | MATH | PHY  | FREE| CS   | PE  |
| Wednesday | CS   | BIO  | FREE | MATH | CHEM | FREE| ENG  | PHY |
| Thursday  | PHY  | HIST | ENG  | FREE | CS   | MATH| FREE | PE  |
| Friday    | CHEM | ENG  | PHY  | BIO  | HIST | FREE| MATH | FREE|
| Saturday  | BIO  | FREE | CS   | PHY  | ENG  | MATH| FREE | CHEM|

---

## ✉️ SMS Alert Types

| Action | SMS Sent |
|--------|----------|
| Teacher cancels period | 📚 CLASS ALERT — period is CANCELLED |
| Teacher restores period | ✅ CLASS RESTORED — class is BACK ON |
| Teacher offers free period | 📗 EXTRA CLASS ANNOUNCED |
| Teacher withdraws free slot | ❌ EXTRA CLASS CANCELLED |
| Daily 7 AM cron | 📅 TODAY'S SCHEDULE |

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| GET  | /api/timetable | Full weekly timetable |
| GET  | /api/timetable/date/:date | Timetable for a specific date |
| POST | /api/changes | Cancel a period (teacher) |
| PATCH| /api/changes/:id/restore | Restore a period (teacher) |
| GET  | /api/free-slots/my-periods?date= | Teacher's period grid for a date |
| POST | /api/free-slots | Offer extra class on free period |
| GET  | /api/notifications | My notifications (student) |
| GET  | /api/notifications/all | All notifications (debug) |
| GET  | /api/health | Server health + Twilio status |

---

## 🔧 Troubleshooting

**All periods show as Free in teacher timetable:**
→ Database not seeded. Run: `npm run seed` then restart server.

**SMS not sending:**
→ Check `backend/.env` has correct Twilio credentials.
→ Check terminal for error messages.
→ Without Twilio: messages appear in terminal as [MOCK SMS].

**CORS error:**
→ Ensure `FRONTEND_URL=http://localhost:4200` in `.env`.

**MongoDB connection error:**
→ Ensure MongoDB is running (`mongod` or MongoDB Atlas URI in `.env`).
