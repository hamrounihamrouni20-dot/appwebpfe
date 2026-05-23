SolarWatch Mail Server

Lightweight mail microservice for SolarWatch. Uses Nodemailer with Gmail SMTP (App Password) to send transactional emails.

Architecture

The mail server runs locally on port 5000 and receives HTTP POST requests from:
- Frontend (for welcome emails after user creation, ticket updates, alerts)
- Can also be called from other services

NOTE: The Supabase Edge Function (create-user) does NOT call the mail server because Edge Functions cannot reach localhost. Instead, the frontend calls the mail server after user creation succeeds.

Setup

1. Install dependencies:

```bash
cd mail-server
npm install
```

2. Create a `.env` file in `mail-server` directory with:

```
EMAIL_USER=solarwatch.services@gmail.com
EMAIL_PASS=khll veta fumu qopo
APP_URL=http://localhost:5173
PORT=5000
SUPABASE_URL=https://tcbsoohnpklqfbycjflb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
PASSWORD_RESET_REDIRECT_URL=http://localhost:5173/reset-password
```

3. Start the server:

```bash
npm start
```

The server will listen on `http://localhost:5000` by default.

Routes

- `POST /send-welcome-email` - Body: `{ fullName, email, password, role }`
- `POST /send-ticket-update` - Body: `{ email, ticketTitle, status, technicianMessage }`
- `POST /send-alert` - Body: `{ email, alertType, alertMessage, severity }`
- `POST /send-password-reset` - Body: `{ email, resetLink }`

All endpoints expect JSON and return `{ success: boolean, error?: string }`.

Running Frontend and Mail Server Together

Terminal 1 (Mail Server):
```bash
cd mail-server
npm start
```

Terminal 2 (Frontend):
```bash
npm run dev
```

Troubleshooting

- If emails fail to send, check console logs on the mail server for Gmail SMTP errors
- Ensure Gmail App Password is correct (use app-specific password, not your main password)
- Make sure 2-step verification is enabled on your Google account
- The frontend must be able to reach `http://localhost:5000` (check CORS headers)
