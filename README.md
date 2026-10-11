# Fintara Loans — Setup and Grader Guide

This document explains how to install, configure, run, and test the Fintara Loans Laravel API and React frontend locally.

## 1. Project overview

The application contains:

- **Laravel REST API** for authentication, loan creation, loan listing, loan details, schedule calculation, and settlement quotes.
- **React + Vite frontend** for signing in, entering loan details, calculating schedules, saving loans, viewing saved loans, and calculating settlements.
- **MySQL** database for user and loan records.
- **Laravel Sanctum** bearer-token authentication for protected API routes.

### Expected local ports

| Component | Port / URL |
|---|---|
| Laravel API | `http://127.0.0.1:8000` |
| API base URL | `http://127.0.0.1:8000/api` |
| React + Vite frontend | `http://localhost:5173` |
| MySQL | Usually `127.0.0.1:3306` |

If a port is already in use, select another port and update the frontend API URL or CORS configuration accordingly.

## 2. Prerequisites

Install these before starting:

- PHP supported by your Laravel 12 release (PHP 8.2 or newer is normally appropriate).
- Composer 2.
- MySQL or MariaDB.
- Git (optional, for cloning the repository).

Check installations:

```powershell
php -v
composer --version
node -v
npm -v
mysql --version
```

On Windows, if PHP is supplied by XAMPP, make sure the XAMPP PHP directory is on `PATH`, or run commands using the full PHP executable path.

## 3. Project folder layout

The development paths used are:

```text
C:\Fintara\fintara-loans
C:\Fintara\fintara-loans-frontend
```

Substitute the correct paths if the projects are stored elsewhere.

## 4. Configure the MySQL database

Start MySQL using XAMPP or your local MySQL installation.

Create a database:

```sql
CREATE DATABASE fintara_loans
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

In `C:\Fintara\fintara-loans\.env`, configure the database:

```env
APP_NAME="Fintara Loans"
APP_ENV=local
APP_DEBUG=true
APP_URL=http://127.0.0.1:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=fintara_loans
DB_USERNAME=root
DB_PASSWORD=
```

Use your actual MySQL username and password. A blank password is only an example for some local XAMPP installations.

Generate the Laravel key if it has not already been generated:

```powershell
cd C:\Fintara\fintara-loans
php artisan key:generate
```

Ensure Sanctum and API routes are installed. The setup command used during development was:

```powershell
php artisan install:api
```

Run migrations:

```powershell
php artisan migrate
```

If your project has seeders you intend to use, inspect them before running:

```powershell
php artisan db:seed
```

Do not run destructive commands such as `migrate:fresh` against a database containing data you need to keep.

## 5. Start the Laravel API

Open a terminal:

```powershell
cd C:\Fintara\fintara-loans
php artisan serve --host=127.0.0.1 --port=8000
```

Leave this terminal running. The API should be available at `http://127.0.0.1:8000`.

Useful checks in a second terminal:

```powershell
cd C:\Fintara\fintara-loans
php artisan route:list --path=api
php artisan config:show cors
```

Expected endpoints:

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| `POST` | `/api/register` | Public, rate-limited | Create a user |
| `POST` | `/api/login` | Public, rate-limited | Sign in and receive a token |
| `POST` | `/api/logout` | Bearer token | Revoke the current token |
| `GET` | `/api/user` | Bearer token | Return the authenticated user |
| `GET` | `/api/loans` | Bearer token | List the current user's loans |
| `POST` | `/api/loans` | Bearer token | Save a loan |
| `GET` | `/api/loans/{loan}` | Bearer token | View a loan owned by the user |
| `POST` | `/api/loans/schedule` | Bearer token | Calculate a repayment schedule |
| `POST` | `/api/loans/settlement` | Bearer token | Calculate an early settlement quote |

Loan routes are expected to use `auth:sanctum`. A `401` response from a protected route without a bearer token is expected.

## 6. CORS configuration

The frontend origin must be allowed by Laravel. In `config/cors.php`, confirm these settings are present:

```php
'paths' => ['api/*', 'sanctum/csrf-cookie'],
'allowed_methods' => ['*'],
'allowed_origins' => [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
],
'allowed_origins_patterns' => [],
'allowed_headers' => ['*'],
'exposed_headers' => [],
'max_age' => 0,
'supports_credentials' => false,
```

After changing environment or configuration files, clear cached configuration:

```powershell
php artisan optimize:clear
```

A browser CORS message can be a secondary symptom of a Laravel `500` error. Check `storage/logs/laravel.log` for the underlying exception.

## 7. Start the React frontend

Open a separate terminal:

```powershell
cd C:\Fintara\fintara-loans-frontend
npm install
```

Create or check `.env` in the frontend folder:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

Start Vite:

```powershell
npm run dev -- --host 127.0.0.1
```

Open the URL printed by Vite. It is usually `http://127.0.0.1:5173`.

If the frontend uses `http://localhost:5173`, that origin is also allowed by the CORS configuration above. Restart Vite after changing its `.env` file.

## 8. First-time usage

1. Open the React frontend.
2. Register a user, then sign in.
3. Enter the principal, annual interest rate, and loan term.
4. Optionally add extra repayments by month and late repayments by month using the row controls.
5. Select **Calculate schedule** to calculate without saving.
6. Select **Save loan** to persist the loan for the authenticated user.
7. Open a saved loan to review its schedule.
8. Use the settlement tab to request a quote for a month and number of additional days.

Example inputs:

| Field | Example |
|---|---:|
| Principal | `120000` |
| Annual interest rate | `12` |
| Term | `12` months |
| Extra repayment | Month `3`, amount `5000` |
| Late repayment | Month `2`, days late `10` |

Leave optional adjustment sections empty if there are no prepayments or late payments to simulate.

## 9. Calculation rules

The current `LoanScheduleService` is intended to implement:

- Monthly rate = annual interest rate / 12 / 100.
- EMI uses the reducing-balance formula; at zero interest, EMI before rounding is principal / term.
- EMI is rounded up to a multiple of 10.
- Monthly interest is rounded half up to two decimal places.
- Principal repayment is EMI minus interest, capped at the remaining balance.
- The schedule stops when the balance reaches zero or the configured term is reached.
- A prepayment is applied after the regular instalment and capped at the remaining balance.
- A 2% prepayment fee applies in months 1–12; after month 12 the fee is zero.
- A late-payment penalty applies only after the three-day grace period, capped at 5% of that instalment's actual payment.
- Settlement adds the post-instalment balance, actual/365 accrued simple interest, and a closure fee of 3% before month 24 or 1% from month 24 onward.

These rules describe schedule calculations. The endpoints described here do **not** by themselves establish a separate persisted transaction ledger for recording real-world repayments. Do not claim the application records actual payments unless a repayment-recording endpoint and database model have also been implemented.

## 10. API examples for testing

The following examples use PowerShell. Replace the email and password with your test user's credentials.

### Register

```powershell
$registerBody = @{
  name = "Grader User"
  email = "grader@example.com"
  password = "ChangeMe123!"
  password_confirmation = "ChangeMe123!"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8000/api/register" `
  -ContentType "application/json" `
  -Body $registerBody
```

Check `RegisterRequest` and `AuthController` to ensure the registration field names match this example.

### Login and store the token

```powershell
$loginBody = @{
  email = "grader@example.com"
  password = "ChangeMe123!"
} | ConvertTo-Json

$login = Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8000/api/login" `
  -ContentType "application/json" `
  -Body $loginBody

$token = $login.token
$headers = @{ Authorization = "Bearer $token"; Accept = "application/json" }
```

If the token is nested under another response key, adjust `$login.token` to match the actual login response.

### Calculate a schedule

```powershell
$scheduleBody = @{
  principal = 120000
  annual_rate = 12
  n = 12
  prepayments = @{}
  late_days = @{}
} | ConvertTo-Json -Depth 5

$schedule = Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8000/api/loans/schedule" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $scheduleBody

$schedule | ConvertTo-Json -Depth 10
```

### Calculate with optional adjustments

```powershell
$adjustedBody = @{
  principal = 120000
  annual_rate = 12
  n = 12
  prepayments = @{ "3" = 5000 }
  late_days = @{ "2" = 10 }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8000/api/loans/schedule" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $adjustedBody
```

### Save a loan

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8000/api/loans" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $scheduleBody
```

The expected response is HTTP `201` and includes a `loan` object.

### Get saved loans

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri "http://127.0.0.1:8000/api/loans" `
  -Headers $headers
```

### Get a settlement quote

```powershell
$settlementBody = @{
  principal = 120000
  annual_rate = 12
  n = 12
  prepayments = @{}
  late_days = @{}
  m = 6
  d = 10
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8000/api/loans/settlement" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $settlementBody
```

### Test validation behavior

Set `n = 0` in a schedule request. The API should return HTTP `422` with a field-level validation message. Also test a prepayment month greater than `n`.

## 11. Troubleshooting

### `401 Unauthorized`

- Sign in again.
- Confirm the login response contains a Sanctum plain-text token.
- Confirm `AuthController` uses `createToken(...)`.
- Confirm `User` uses `Laravel\Sanctum\HasApiTokens`.
- Ensure the request includes `Authorization: Bearer <token>`.

### Browser CORS error

1. Confirm Laravel is running on port 8000.
2. Confirm `VITE_API_BASE_URL` is correct.
3. Confirm the frontend's exact origin is in `config/cors.php`.
4. Run `php artisan optimize:clear`.
5. Check `storage/logs/laravel.log`; a backend exception can cause a misleading CORS error.
6. Restart Laravel and Vite.

### Database connection or migration errors

- Confirm MySQL is running.
- Verify `DB_DATABASE`, `DB_USERNAME`, and `DB_PASSWORD`.
- Run `php artisan migrate:status`.
- Do not delete or recreate tables blindly if they contain important data.

### Frontend dependency or build errors

```powershell
cd C:\Fintara\fintara-loans-frontend
npm install
npm run build
```

Resolve any build errors before submission.

### Inspect Laravel logs

```powershell
cd C:\Fintara\fintara-loans
Get-Content .\storage\logs\laravel.log -Tail 100
```

## 12. Pre-submission checklist

- [ ] Both projects are included or repository links are provided.
- [ ] `.env.example` files are included with placeholders; real `.env` files and secrets are not committed.
- [ ] Database setup and migration commands work.
- [ ] Laravel API starts on port 8000.
- [ ] React frontend starts on port 5173.
- [ ] A user can register and sign in.
- [ ] Protected routes reject requests without a valid token.
- [ ] A user can calculate and save a loan.
- [ ] Saved loans are scoped to the authenticated user.
- [ ] Prepayment and late-payment adjustments affect the returned schedule.
- [ ] Settlement returns a breakdown.
- [ ] Invalid inputs return `422` validation responses.
- [ ] `npm run build` succeeds.
- [ ] Setup instructions match the actual project files and environment.

