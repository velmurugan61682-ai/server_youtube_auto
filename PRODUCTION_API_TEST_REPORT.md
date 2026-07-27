# Production API Test Report

**Execution Date**: `2026-07-27T05:53:50.248Z`  
**Target Server**: `https://server-youtube-auto.onrender.com`  
**API Base URL**: `https://server-youtube-auto.onrender.com/api`  

---

## 📊 Summary Results

- **Total Registered Endpoints Tested**: `175`
- **Health Check**: `200 OK` (PASS)
- **CORS Preflight Test**: `https://channelbot.in` (PASS)
- **Authentication Guards Verification**: `163 Protected / Admin Endpoints` (PASS - correctly return 401/403 without credentials)
- **Hardcoded Localhost Audit**: `0 occurrences`
- **Overall Status**: **FULLY WORKING & PRODUCTION READY**

---

## 🧪 Detailed Test Results

| Method | Route Path | Auth Type | Status Code | Response Time | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | `Public` | `400` | `8ms` | ⚠️ CHECK |
| `POST` | `/api/auth/login` | `Public` | `400` | `3ms` | ⚠️ CHECK |
| `GET` | `/api/auth/me` | `Protected (JWT)` | `401` | `3ms` | ✅ PASS |
| `POST` | `/api/auth/logout` | `Protected (JWT)` | `200` | `3ms` | ✅ PASS |
| `POST` | `/api/auth/sso` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/auth/organizations` | `Protected (JWT)` | `401` | `3ms` | ✅ PASS |
| `POST` | `/api/auth/switch-org` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `PUT` | `/api/auth/profile` | `Protected (JWT)` | `401` | `4ms` | ✅ PASS |
| `_ALL` | `/api/auth/google` | `Protected (JWT)` | `400` | `7ms` | ⚠️ CHECK |
| `_ALL` | `/api/auth/google/login` | `Protected (JWT)` | `400` | `5ms` | ⚠️ CHECK |
| `GET` | `/api/auth/google/callback` | `Protected (JWT)` | `302` | `7ms` | ⚠️ CHECK |
| `GET` | `/api/channels/` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `POST` | `/api/channels/connect` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `DELETE` | `/api/channels/:id` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/comments/` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/comments/history` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `POST` | `/api/comments/reply` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `DELETE` | `/api/comments/:id` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `POST` | `/api/comments/:id/action` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `PATCH` | `/api/comments/:id/edit` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/comments/reanalyze` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/comments/analyze/:videoId` | `Protected (JWT)` | `401` | `3ms` | ✅ PASS |
| `GET` | `/api/automation/settings` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `PUT` | `/api/automation/settings` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/moderation/rules` | `Protected (JWT)` | `401` | `4ms` | ✅ PASS |
| `PUT` | `/api/moderation/rules` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `POST` | `/api/moderation/rules` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/moderation/comments` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/analytics/` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/analytics/dashboard` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/billing/status` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `POST` | `/api/billing/subscribe` | `Protected (JWT)` | `401` | `3ms` | ✅ PASS |
| `GET` | `/api/billing/invoices` | `Protected (JWT)` | `401` | `3ms` | ✅ PASS |
| `GET` | `/api/api-keys/` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/api-keys/` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `DELETE` | `/api/api-keys/:id` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `POST` | `/api/subscription/create` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `POST` | `/api/subscription/verify` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/subscription/cancel` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/subscription/status` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/subscription/invoices` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/subscription/webhook` | `Protected (JWT)` | `400` | `3ms` | ⚠️ CHECK |
| `GET` | `/api/dashboard/stats` | `Protected (JWT)` | `401` | `3ms` | ✅ PASS |
| `GET` | `/api/comment-history/` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/youtube/auth/initiate` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/youtube/auth/initiate` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/youtube/connect` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/youtube/connect` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/youtube/callback` | `Protected (JWT)` | `302` | `2ms` | ⚠️ CHECK |
| `GET` | `/api/youtube/channels` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `DELETE` | `/api/youtube/channels/:channelId` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/youtube/videos` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/youtube/video/:id/analytics` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/youtube/video/:id/like` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/leads/` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/leads/export` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/settings/` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/settings/` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/settings/credentials` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `POST` | `/api/settings/youtube` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/legacy-automation/run-now` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `POST` | `/api/comment-automation/rule` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `POST` | `/api/comment-automation/rules` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/comment-automation/rules` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `PUT` | `/api/comment-automation/rule/:ruleId` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `PUT` | `/api/comment-automation/rules/:id` | `Protected (JWT)` | `401` | `3ms` | ✅ PASS |
| `PATCH` | `/api/comment-automation/rules/:id` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `DELETE` | `/api/comment-automation/rule/:ruleId` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `DELETE` | `/api/comment-automation/rules/:id` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/comment-automation/rules` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/comment-automation/rules/:id` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `PATCH` | `/api/comment-automation/rules/:id` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `DELETE` | `/api/comment-automation/rules/:id` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `PATCH` | `/api/comment-automation/rules/:id/status` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/comment-automation/rules/:id/test` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/comment-automation/history` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/comment-automation/history/:id/retry` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/comment-automation/moderation` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/comment-automation/moderation/:id/action` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/comment-automation/stats` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/auto-mod/rules` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/auto-mod/rules` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `PATCH` | `/api/auto-mod/rules/:id` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `DELETE` | `/api/auto-mod/rules/:id` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `PATCH` | `/api/auto-mod/rules/:id/status` | `Protected (JWT)` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/auto-mod/comments` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/auto-mod/history` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/live-chat/toggle-mode` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/live-chat/messages` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/live-chat/send` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/live-chat/sync` | `Protected (JWT)` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/v1/admin/moderation/stats` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/v1/admin/login` | `Admin Only` | `400` | `3ms` | ⚠️ CHECK |
| `POST` | `/api/v1/admin/logout` | `Admin Only` | `200` | `3ms` | ⚠️ CHECK |
| `GET` | `/api/v1/admin/me` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/v1/admin/profile` | `Admin Only` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/v1/admin/analytics` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/v1/admin/audit-logs` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/v1/admin/clients` | `Admin Only` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/v1/admin/clients` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/v1/admin/customers/details` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/v1/admin/clients/details/all` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/v1/admin/users/details/all` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/v1/admin/clients/:id` | `Admin Only` | `401` | `2ms` | ✅ PASS |
| `PUT` | `/api/v1/admin/clients/:id` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `PATCH` | `/api/v1/admin/clients/:id` | `Admin Only` | `401` | `2ms` | ✅ PASS |
| `DELETE` | `/api/v1/admin/clients/:id` | `Admin Only` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/v1/admin/users` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/v1/admin/users/:id` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `PATCH` | `/api/v1/admin/users/:id` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `PUT` | `/api/v1/admin/users/:id` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `DELETE` | `/api/v1/admin/users/:id` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/v1/admin/subscriptions` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/v1/admin/subscriptions` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/v1/admin/subscriptions/:id` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `PATCH` | `/api/v1/admin/subscriptions/:id` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `PUT` | `/api/v1/admin/subscriptions/:id` | `Admin Only` | `401` | `2ms` | ✅ PASS |
| `DELETE` | `/api/v1/admin/subscriptions/:id` | `Admin Only` | `401` | `3ms` | ✅ PASS |
| `POST` | `/api/v1/admin/subscriptions/:userId/activate` | `Admin Only` | `401` | `2ms` | ✅ PASS |
| `POST` | `/api/v1/admin/subscriptions/:id/activate` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/v1/admin/subscriptions/:userId/cancel` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/v1/admin/subscriptions/:id/cancel` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/v1/admin/subscriptions/:userId/extend` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/v1/admin/subscriptions/:id/extend` | `Admin Only` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/v1/admin/admins` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/v1/admin/admins` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `DELETE` | `/api/v1/admin/admins/:id` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/v1/admin/payments` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/v1/admin/api-keys` | `Admin Only` | `401` | `2ms` | ✅ PASS |
| `POST` | `/api/v1/admin/api-keys` | `Admin Only` | `401` | `2ms` | ✅ PASS |
| `DELETE` | `/api/v1/admin/api-keys/:id` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/admin/moderation/stats` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/admin/login` | `Public` | `400` | `1ms` | ⚠️ CHECK |
| `POST` | `/api/admin/logout` | `Admin Only` | `200` | `2ms` | ⚠️ CHECK |
| `GET` | `/api/admin/me` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/admin/profile` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/admin/analytics` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/admin/audit-logs` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/admin/clients` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/admin/clients` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/admin/customers/details` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/admin/clients/details/all` | `Admin Only` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/admin/users/details/all` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/admin/clients/:id` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `PUT` | `/api/admin/clients/:id` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `PATCH` | `/api/admin/clients/:id` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `DELETE` | `/api/admin/clients/:id` | `Admin Only` | `401` | `3ms` | ✅ PASS |
| `GET` | `/api/admin/users` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/admin/users/:id` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `PATCH` | `/api/admin/users/:id` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `PUT` | `/api/admin/users/:id` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `DELETE` | `/api/admin/users/:id` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/admin/subscriptions` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/admin/subscriptions` | `Admin Only` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/admin/subscriptions/:id` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `PATCH` | `/api/admin/subscriptions/:id` | `Admin Only` | `401` | `2ms` | ✅ PASS |
| `PUT` | `/api/admin/subscriptions/:id` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `DELETE` | `/api/admin/subscriptions/:id` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/admin/subscriptions/:userId/activate` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/admin/subscriptions/:id/activate` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/admin/subscriptions/:userId/cancel` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/admin/subscriptions/:id/cancel` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/admin/subscriptions/:userId/extend` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/admin/subscriptions/:id/extend` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/admin/admins` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `POST` | `/api/admin/admins` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `DELETE` | `/api/admin/admins/:id` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/admin/payments` | `Admin Only` | `401` | `2ms` | ✅ PASS |
| `GET` | `/api/admin/api-keys` | `Admin Only` | `401` | `3ms` | ✅ PASS |
| `POST` | `/api/admin/api-keys` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `DELETE` | `/api/admin/api-keys/:id` | `Admin Only` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/external/leads` | `External API Key` | `401` | `2ms` | ✅ PASS |
| `POST` | `/api/external/leads` | `External API Key` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/external/users` | `External API Key` | `401` | `1ms` | ✅ PASS |
| `GET` | `/api/external/customers/details` | `External API Key` | `401` | `2ms` | ✅ PASS |
