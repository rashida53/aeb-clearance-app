# AEB Clearance App

Clearance letter generation and pledge management portal for Anjuman-e-Burhani (Austin). Members log in to view open pledges, generate clearance letters (Safaai Chitthi), and manage wajebaat payments. Admins can review and approve users with outstanding balances.

## Tech Stack

- **Frontend:** React 18, Apollo Client, React Router v6, `@react-pdf/renderer`
- **Backend:** Express, Apollo Server Express (GraphQL), Mongoose 8
- **Database:** MongoDB (two separate databases)
- **Auth:** JWT (30-day expiry), bcrypt password hashing
- **Email:** Nodemailer via Gmail SMTP

## Project Structure

```
├── client/                    React frontend (CRA)
│   └── src/
│       ├── App.js             Routes and Apollo provider
│       ├── components/        Nav, Hamburger
│       ├── pages/
│       │   ├── user/          Login, Reset, GET_ME query
│       │   ├── openBalances/  Dashboard (home page) — open pledges + approval status
│       │   ├── letter/        Letter wizard + PDF generation
│       │   ├── wajebaat/      Wajebaat payment flow
│       │   ├── review/        Admin approval page (LETTER_ADMIN only)
│       │   └── admin/         Admin placeholder
│       └── utils/             PrivateRoute, auth helpers
│
├── server/
│   ├── server.js              Express + Apollo setup, port 3001
│   ├── config/connection.js   Two Mongoose connections (clearanceDb, fmbDb)
│   ├── models/
│   │   ├── Member.js          Login accounts (fmbDb)
│   │   ├── User.js            Community profiles (fmbDb)
│   │   ├── QBOpen.js          Open pledges/balances (fmbDb)
│   │   ├── Approval.js        Approval records (clearanceDb)
│   │   └── Letter.js          Letter generation logs (clearanceDb)
│   ├── schemas/
│   │   ├── typeDefs.js        GraphQL type definitions
│   │   └── resolvers.js       Query and mutation resolvers
│   └── utils/
│       ├── auth.js            JWT sign/verify middleware
│       └── email.js           Nodemailer wrapper
│
└── package.json               Root scripts (develop, build, install)
```

## Databases

The app connects to **two** MongoDB databases:

| Connection    | Env Var                  | Default                              | Collections                |
|---------------|--------------------------|--------------------------------------|----------------------------|
| `clearanceDb` | `MONGODB_URI_CLEARANCE`  | `mongodb://127.0.0.1/aeb-clearance-app` | `approvals`, `letters`     |
| `fmbDb`       | `MONGODB_URI_FMB`        | `mongodb://127.0.0.1/aeb-austin-fmb`    | `members`, `users`, `qbopens` |

## Data Models

**Member** (fmbDb) — Login account. Fields: `email`, `password` (bcrypt), `fullName`, `its`, `hofIts`, `roles[]`.

**User** (fmbDb) — Community profile. Fields: `fullName`, `spouseName`, `hofIts` (unique), `zone`, `pickupGroup`, `isActive`, `roles[]`.

**QBOpen** (fmbDb) — Open pledge/balance. Fields: `hofIts`, `its`, `user` (ref User), `qb_id` (unique), `amount`, `balance`, `due`, `customer`, `pp`.

**Approval** (clearanceDb) — Admin approval for users with open balances. Fields: `hofIts`, `requester` (ObjectId), `approver` (name string), `remarks`, `approvedAt` (timestamp). Valid for 30 days.

**Letter** (clearanceDb) — Log of letter generations with valid approval. Fields: `requester` (ObjectId), `approver` (name string), `reason`. Auto-timestamps via Mongoose.

## Auth and Roles

- JWT stored in `localStorage` as `id_token`, sent as `Bearer` token in Authorization header
- Token payload contains the full `LoggedInUser` object (userId, memberIts, roles, etc.)
- Roles are merged from both `Member.roles` and `User.roles`
- `LETTER_ADMIN` role gates: `getAllActiveUsers` query, `createApproval` mutation, `/review` route

## Key Flows

### Letter Generation
1. User navigates to `/letter`, picks Reason > Sub-option > (Laagat/Event/FMB) > Description
2. PDF is generated client-side via `@react-pdf/renderer` and downloaded
3. `generateLetter` mutation fires to: log the letter (if valid approval exists) and send email notification
4. Approval is "valid" if: user has no open balances, OR has an approval record within the last 30 days

### Approval Flow
1. Admin goes to `/review`, searches for a user
2. Sees user's open pledges
3. Enters remarks and submits approval via `createApproval` mutation
4. Approval is valid for 30 days from creation

## GraphQL API

### Queries
| Query                              | Auth Required | Role Required  | Description                       |
|------------------------------------|---------------|----------------|-----------------------------------|
| `me`                               | Yes           | —              | Current logged-in user info       |
| `getMyOpenBalances(hofIts)`        | No            | —              | Open pledges by HOF ITS           |
| `getMyQbOpens(userId)`             | No            | —              | Open pledges by user ObjectId     |
| `getApprovalStatus(hofIts, userId)`| Yes           | —              | Check if user has valid approval  |
| `getAllActiveUsers`                | Yes           | `LETTER_ADMIN` | All active community members      |

### Mutations
| Mutation                                           | Auth Required | Role Required  | Description                        |
|----------------------------------------------------|---------------|----------------|------------------------------------|
| `login(email, password)`                           | No            | —              | Authenticate, returns JWT          |
| `addMember(email, password, fullName, its, hofIts)`| No            | —              | Register new account               |
| `resetPassword(its, hofIts, password)`             | No            | —              | Reset password (ITS + HOF verify)  |
| `generateLetter(hofIts, hofName, reason, description)` | Yes       | —              | Log letter + send email            |
| `createApproval(hofIts, requester, remarks)`       | Yes           | `LETTER_ADMIN` | Create 30-day approval             |

## Environment Variables

Create a `.env` file in the project root (or `server/` directory):

```env
PORT=3001
MONGODB_URI_CLEARANCE=mongodb://127.0.0.1/aeb-clearance-app
MONGODB_URI_FMB=mongodb://127.0.0.1/aeb-austin-fmb
JWT_SECRET=your-secret-here
EMAIL_SENDER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-gmail-app-password
LETTER_RECIPIENTS=recipient1@email.com,recipient2@email.com
```

## Getting Started

```bash
# Install all dependencies (root, server, client)
npm install

# Start both server and client in development mode
npm run develop
```

- Backend runs on `http://localhost:3001`
- GraphQL playground at `http://localhost:3001/graphql`
- Frontend runs on `http://localhost:3000` (proxies API requests to 3001)

### Prerequisites
- Node.js 18.x
- MongoDB running locally (or remote URIs configured)

### Production Build

```bash
npm run build    # Builds the React client
npm start        # Serves the built client + API from port 3001
```

## Frontend Routes

| Path       | Component      | Access          | Description                  |
|------------|----------------|-----------------|------------------------------|
| `/login`   | Login          | Public          | Sign in                      |
| `/reset`   | Reset          | Public          | Password reset               |
| `/`        | OpenBalances   | Authenticated   | Dashboard — open pledges     |
| `/letter`  | Letter         | Authenticated   | Letter generation wizard     |
| `/wajebaat`| Wajebaat       | Authenticated   | Wajebaat payment flow        |
| `/admin`   | Admin          | Authenticated   | Admin page (placeholder)     |
| `/review`  | Review         | `LETTER_ADMIN`  | Approve users with balances  |
