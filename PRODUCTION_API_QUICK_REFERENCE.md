# ChannelMate Production API Quick Reference

Production base URL: `https://server-youtube-auto.onrender.com/api`

Use this quick reference for common production integrations. Keep live tokens and API keys out of source control and Postman exports; use environment variables or secret Postman variables instead.

## Authentication Headers

| Auth type | Header | Source |
| --- | --- | --- |
| Client bearer token | `Authorization: Bearer <your_jwt_token>` | `POST /auth/login` |
| Admin bearer token | `Authorization: Bearer <your_admin_token>` | `POST /admin/login` |
| External API key | `x-api-key: <external_api_key>` | Secret value from `EXTERNAL_ADMIN_API_KEY` |

## System Health

| Method | Endpoint | Auth |
| --- | --- | --- |
| `GET` | `/health` | Public |

## User Authentication

| Method | Endpoint | Auth | Body |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | Public | `{ "email": "user@example.com", "password": "Password@123" }` |
| `POST` | `/auth/register` | Public | `{ "name": "Test Creator", "email": "creator@example.com", "password": "Password@123" }` |
| `GET` | `/auth/me` | Client bearer | None |
| `PUT` | `/auth/profile` | Client bearer | `{ "name": "Updated Creator Name" }` |

## YouTube Channels

| Method | Endpoint | Auth |
| --- | --- | --- |
| `POST` | `/youtube/auth/initiate` | Client bearer |
| `GET` | `/channels` | Client bearer |
| `DELETE` | `/channels/<channelId>` | Client bearer |

## Analytics

| Method | Endpoint | Auth |
| --- | --- | --- |
| `GET` | `/analytics/overview` | Client bearer |
| `GET` | `/analytics/sentiment-breakdown` | Client bearer |
| `GET` | `/analytics/top-videos` | Client bearer |
| `GET` | `/analytics/dashboard` | Client bearer |

## Automation

| Method | Endpoint | Auth | Body |
| --- | --- | --- | --- |
| `GET` | `/automation/settings` | Client bearer | None |
| `PUT` | `/automation/settings` | Client bearer | `{ "confidenceThreshold": 85, "autoLike": true }` |
| `POST` | `/automation/trigger-sync` | Client bearer | None |

## Moderation

| Method | Endpoint | Auth | Body |
| --- | --- | --- | --- |
| `GET` | `/moderation/rules` | Client bearer | None |
| `PUT` | `/moderation/rules` | Client bearer | `{ "autoMod": true, "confidenceThreshold": 85, "action": "delete" }` |
| `GET` | `/moderation/logs` | Client bearer | None |

## Comments

| Method | Endpoint | Auth | Body |
| --- | --- | --- | --- |
| `GET` | `/comments` | Client bearer | None |
| `POST` | `/comments/<commentId>/reply` | Client bearer | `{ "text": "Thank you for watching!" }` |
| `POST` | `/comments/<commentId>/like` | Client bearer | None |
| `DELETE` | `/comments/<commentId>` | Client bearer | None |

## Leads

| Method | Endpoint | Auth |
| --- | --- | --- |
| `GET` | `/leads` | Client bearer |
| `GET` | `/leads/export` | Client bearer |

## Billing And Subscriptions

| Method | Endpoint | Auth |
| --- | --- | --- |
| `GET` | `/subscription/status` | Client bearer |
| `GET` | `/billing/invoices` | Client bearer |

## External Customer Details

| Method | Endpoint | Auth |
| --- | --- | --- |
| `GET` | `/external/customers/details` | External API key |
| `GET` | `/v1/external/customers/details` | External API key |

## Admin Security Console

| Method | Endpoint | Auth | Body |
| --- | --- | --- | --- |
| `POST` | `/admin/login` | Public | `{ "email": "admin@channelbot.in", "password": "Password@123" }` |
| `GET` | `/admin/stats` | Admin bearer | None |
| `GET` | `/admin/users` | Admin bearer | None |
| `GET` | `/admin/customers/details` | Admin bearer | None |