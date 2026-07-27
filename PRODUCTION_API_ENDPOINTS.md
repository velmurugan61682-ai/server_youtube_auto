# ChannelMate Production API Endpoints Reference

**Production Base URL**: `https://server-youtube-auto.onrender.com/api`  
**Frontend URL**: `https://channelbot.in`  
**Verified Timestamp**: `2026-07-27T05:53:50.248Z`  
**Total Endpoints Registered**: `175`  

---

## 📊 Summary of Endpoint Categories

- **Public Endpoints**: 12
- **JWT Protected Endpoints**: 86
- **Admin Only Endpoints**: 72
- **External Integration Endpoints**: 5

---

## 📋 Endpoint Details

### 1. POST `/api/auth/register`

- **Category**: Authentication
- **HTTP Method**: `POST`
- **Route Path**: `/api/auth/register`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/auth/register`
- **Access Level**: `Public`
- **Required Headers**:
  - `Content-Type: application/json`
- **Live Test Status Code**: `400` (EXPECTED AUTH GUARD)
- **Response Time**: `8ms`
- **Sample Body / Response**:
```json
{"error":"Name is required"}
```

---

### 2. POST `/api/auth/login`

- **Category**: Authentication
- **HTTP Method**: `POST`
- **Route Path**: `/api/auth/login`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/auth/login`
- **Access Level**: `Public`
- **Required Headers**:
  - `Content-Type: application/json`
- **Live Test Status Code**: `400` (EXPECTED AUTH GUARD)
- **Response Time**: `3ms`
- **Sample Body / Response**:
```json
{"error":"Please provide a valid email"}
```

---

### 3. GET `/api/auth/me`

- **Category**: Authentication
- **HTTP Method**: `GET`
- **Route Path**: `/api/auth/me`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/auth/me`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `3ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 4. POST `/api/auth/logout`

- **Category**: Authentication
- **HTTP Method**: `POST`
- **Route Path**: `/api/auth/logout`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/auth/logout`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `200` (PASS)
- **Response Time**: `3ms`
- **Sample Body / Response**:
```json
{"success":true}
```

---

### 5. POST `/api/auth/sso`

- **Category**: Authentication
- **HTTP Method**: `POST`
- **Route Path**: `/api/auth/sso`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/auth/sso`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Invalid SSO credentials"}
```

---

### 6. GET `/api/auth/organizations`

- **Category**: Authentication
- **HTTP Method**: `GET`
- **Route Path**: `/api/auth/organizations`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/auth/organizations`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `3ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 7. POST `/api/auth/switch-org`

- **Category**: Authentication
- **HTTP Method**: `POST`
- **Route Path**: `/api/auth/switch-org`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/auth/switch-org`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 8. PUT `/api/auth/profile`

- **Category**: Authentication
- **HTTP Method**: `PUT`
- **Route Path**: `/api/auth/profile`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/auth/profile`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `4ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 9. _ALL `/api/auth/google`

- **Category**: Google OAuth
- **HTTP Method**: `_ALL`
- **Route Path**: `/api/auth/google`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/auth/google`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `400` (EXPECTED AUTH GUARD)
- **Response Time**: `7ms`
- **Sample Body / Response**:
```json
{}
```

---

### 10. _ALL `/api/auth/google/login`

- **Category**: Google OAuth
- **HTTP Method**: `_ALL`
- **Route Path**: `/api/auth/google/login`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/auth/google/login`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `400` (EXPECTED AUTH GUARD)
- **Response Time**: `5ms`
- **Sample Body / Response**:
```json
{}
```

---

### 11. GET `/api/auth/google/callback`

- **Category**: Google OAuth
- **HTTP Method**: `GET`
- **Route Path**: `/api/auth/google/callback`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/auth/google/callback`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `302` (EXPECTED AUTH GUARD)
- **Response Time**: `7ms`
- **Sample Body / Response**:
```json
Found. Redirecting to http://localhost:5173/?status=error&error=Missing%20state%20parameter
```

---

### 12. GET `/api/channels/`

- **Category**: YouTube & Channels
- **HTTP Method**: `GET`
- **Route Path**: `/api/channels/`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/channels/`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 13. POST `/api/channels/connect`

- **Category**: YouTube & Channels
- **HTTP Method**: `POST`
- **Route Path**: `/api/channels/connect`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/channels/connect`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 14. DELETE `/api/channels/:id`

- **Category**: YouTube & Channels
- **HTTP Method**: `DELETE`
- **Route Path**: `/api/channels/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/channels/:id`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 15. GET `/api/comments/`

- **Category**: Comments
- **HTTP Method**: `GET`
- **Route Path**: `/api/comments/`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comments/`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 16. GET `/api/comments/history`

- **Category**: Comments
- **HTTP Method**: `GET`
- **Route Path**: `/api/comments/history`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comments/history`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 17. POST `/api/comments/reply`

- **Category**: Comments
- **HTTP Method**: `POST`
- **Route Path**: `/api/comments/reply`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comments/reply`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 18. DELETE `/api/comments/:id`

- **Category**: Comments
- **HTTP Method**: `DELETE`
- **Route Path**: `/api/comments/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comments/:id`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 19. POST `/api/comments/:id/action`

- **Category**: Comments
- **HTTP Method**: `POST`
- **Route Path**: `/api/comments/:id/action`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comments/:id/action`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 20. PATCH `/api/comments/:id/edit`

- **Category**: Comments
- **HTTP Method**: `PATCH`
- **Route Path**: `/api/comments/:id/edit`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comments/:id/edit`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 21. POST `/api/comments/reanalyze`

- **Category**: Comments
- **HTTP Method**: `POST`
- **Route Path**: `/api/comments/reanalyze`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comments/reanalyze`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 22. GET `/api/comments/analyze/:videoId`

- **Category**: Comments
- **HTTP Method**: `GET`
- **Route Path**: `/api/comments/analyze/:videoId`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comments/analyze/:videoId`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `3ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 23. GET `/api/automation/settings`

- **Category**: Auto Moderation
- **HTTP Method**: `GET`
- **Route Path**: `/api/automation/settings`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/automation/settings`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 24. PUT `/api/automation/settings`

- **Category**: Auto Moderation
- **HTTP Method**: `PUT`
- **Route Path**: `/api/automation/settings`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/automation/settings`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 25. GET `/api/moderation/rules`

- **Category**: General Operations
- **HTTP Method**: `GET`
- **Route Path**: `/api/moderation/rules`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/moderation/rules`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `4ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 26. PUT `/api/moderation/rules`

- **Category**: General Operations
- **HTTP Method**: `PUT`
- **Route Path**: `/api/moderation/rules`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/moderation/rules`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 27. POST `/api/moderation/rules`

- **Category**: General Operations
- **HTTP Method**: `POST`
- **Route Path**: `/api/moderation/rules`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/moderation/rules`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 28. GET `/api/moderation/comments`

- **Category**: Comments
- **HTTP Method**: `GET`
- **Route Path**: `/api/moderation/comments`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/moderation/comments`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 29. GET `/api/analytics/`

- **Category**: Analytics & Dashboard
- **HTTP Method**: `GET`
- **Route Path**: `/api/analytics/`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/analytics/`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 30. GET `/api/analytics/dashboard`

- **Category**: Analytics & Dashboard
- **HTTP Method**: `GET`
- **Route Path**: `/api/analytics/dashboard`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/analytics/dashboard`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 31. GET `/api/billing/status`

- **Category**: Subscription & Payments
- **HTTP Method**: `GET`
- **Route Path**: `/api/billing/status`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/billing/status`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 32. POST `/api/billing/subscribe`

- **Category**: Subscription & Payments
- **HTTP Method**: `POST`
- **Route Path**: `/api/billing/subscribe`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/billing/subscribe`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `3ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 33. GET `/api/billing/invoices`

- **Category**: Subscription & Payments
- **HTTP Method**: `GET`
- **Route Path**: `/api/billing/invoices`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/billing/invoices`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `3ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 34. GET `/api/api-keys/`

- **Category**: General Operations
- **HTTP Method**: `GET`
- **Route Path**: `/api/api-keys/`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/api-keys/`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 35. POST `/api/api-keys/`

- **Category**: General Operations
- **HTTP Method**: `POST`
- **Route Path**: `/api/api-keys/`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/api-keys/`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 36. DELETE `/api/api-keys/:id`

- **Category**: General Operations
- **HTTP Method**: `DELETE`
- **Route Path**: `/api/api-keys/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/api-keys/:id`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 37. POST `/api/subscription/create`

- **Category**: Subscription & Payments
- **HTTP Method**: `POST`
- **Route Path**: `/api/subscription/create`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/subscription/create`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 38. POST `/api/subscription/verify`

- **Category**: Subscription & Payments
- **HTTP Method**: `POST`
- **Route Path**: `/api/subscription/verify`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/subscription/verify`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 39. POST `/api/subscription/cancel`

- **Category**: Subscription & Payments
- **HTTP Method**: `POST`
- **Route Path**: `/api/subscription/cancel`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/subscription/cancel`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 40. GET `/api/subscription/status`

- **Category**: Subscription & Payments
- **HTTP Method**: `GET`
- **Route Path**: `/api/subscription/status`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/subscription/status`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 41. GET `/api/subscription/invoices`

- **Category**: Subscription & Payments
- **HTTP Method**: `GET`
- **Route Path**: `/api/subscription/invoices`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/subscription/invoices`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 42. POST `/api/subscription/webhook`

- **Category**: Subscription & Payments
- **HTTP Method**: `POST`
- **Route Path**: `/api/subscription/webhook`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/subscription/webhook`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `400` (EXPECTED AUTH GUARD)
- **Response Time**: `3ms`
- **Sample Body / Response**:
```json
Missing signature
```

---

### 43. GET `/api/dashboard/stats`

- **Category**: Analytics & Dashboard
- **HTTP Method**: `GET`
- **Route Path**: `/api/dashboard/stats`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/dashboard/stats`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `3ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 44. GET `/api/comment-history/`

- **Category**: Comments
- **HTTP Method**: `GET`
- **Route Path**: `/api/comment-history/`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comment-history/`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 45. POST `/api/youtube/auth/initiate`

- **Category**: Authentication
- **HTTP Method**: `POST`
- **Route Path**: `/api/youtube/auth/initiate`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/youtube/auth/initiate`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 46. GET `/api/youtube/auth/initiate`

- **Category**: Authentication
- **HTTP Method**: `GET`
- **Route Path**: `/api/youtube/auth/initiate`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/youtube/auth/initiate`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 47. GET `/api/youtube/connect`

- **Category**: YouTube & Channels
- **HTTP Method**: `GET`
- **Route Path**: `/api/youtube/connect`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/youtube/connect`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 48. POST `/api/youtube/connect`

- **Category**: YouTube & Channels
- **HTTP Method**: `POST`
- **Route Path**: `/api/youtube/connect`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/youtube/connect`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 49. GET `/api/youtube/callback`

- **Category**: Google OAuth
- **HTTP Method**: `GET`
- **Route Path**: `/api/youtube/callback`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/youtube/callback`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `302` (EXPECTED AUTH GUARD)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
Found. Redirecting to http://localhost:5173/?status=error&error=Missing%20state%20parameter
```

---

### 50. GET `/api/youtube/channels`

- **Category**: YouTube & Channels
- **HTTP Method**: `GET`
- **Route Path**: `/api/youtube/channels`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/youtube/channels`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 51. DELETE `/api/youtube/channels/:channelId`

- **Category**: YouTube & Channels
- **HTTP Method**: `DELETE`
- **Route Path**: `/api/youtube/channels/:channelId`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/youtube/channels/:channelId`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 52. GET `/api/youtube/videos`

- **Category**: YouTube & Channels
- **HTTP Method**: `GET`
- **Route Path**: `/api/youtube/videos`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/youtube/videos`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 53. GET `/api/youtube/video/:id/analytics`

- **Category**: YouTube & Channels
- **HTTP Method**: `GET`
- **Route Path**: `/api/youtube/video/:id/analytics`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/youtube/video/:id/analytics`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 54. POST `/api/youtube/video/:id/like`

- **Category**: YouTube & Channels
- **HTTP Method**: `POST`
- **Route Path**: `/api/youtube/video/:id/like`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/youtube/video/:id/like`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 55. GET `/api/leads/`

- **Category**: General Operations
- **HTTP Method**: `GET`
- **Route Path**: `/api/leads/`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/leads/`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 56. GET `/api/leads/export`

- **Category**: General Operations
- **HTTP Method**: `GET`
- **Route Path**: `/api/leads/export`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/leads/export`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 57. GET `/api/settings/`

- **Category**: General Operations
- **HTTP Method**: `GET`
- **Route Path**: `/api/settings/`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/settings/`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 58. POST `/api/settings/`

- **Category**: General Operations
- **HTTP Method**: `POST`
- **Route Path**: `/api/settings/`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/settings/`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 59. POST `/api/settings/credentials`

- **Category**: General Operations
- **HTTP Method**: `POST`
- **Route Path**: `/api/settings/credentials`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/settings/credentials`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 60. POST `/api/settings/youtube`

- **Category**: YouTube & Channels
- **HTTP Method**: `POST`
- **Route Path**: `/api/settings/youtube`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/settings/youtube`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 61. POST `/api/legacy-automation/run-now`

- **Category**: General Operations
- **HTTP Method**: `POST`
- **Route Path**: `/api/legacy-automation/run-now`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/legacy-automation/run-now`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 62. POST `/api/comment-automation/rule`

- **Category**: General Operations
- **HTTP Method**: `POST`
- **Route Path**: `/api/comment-automation/rule`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comment-automation/rule`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 63. POST `/api/comment-automation/rules`

- **Category**: General Operations
- **HTTP Method**: `POST`
- **Route Path**: `/api/comment-automation/rules`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comment-automation/rules`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 64. GET `/api/comment-automation/rules`

- **Category**: General Operations
- **HTTP Method**: `GET`
- **Route Path**: `/api/comment-automation/rules`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comment-automation/rules`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 65. PUT `/api/comment-automation/rule/:ruleId`

- **Category**: General Operations
- **HTTP Method**: `PUT`
- **Route Path**: `/api/comment-automation/rule/:ruleId`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comment-automation/rule/:ruleId`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 66. PUT `/api/comment-automation/rules/:id`

- **Category**: General Operations
- **HTTP Method**: `PUT`
- **Route Path**: `/api/comment-automation/rules/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comment-automation/rules/:id`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `3ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 67. PATCH `/api/comment-automation/rules/:id`

- **Category**: General Operations
- **HTTP Method**: `PATCH`
- **Route Path**: `/api/comment-automation/rules/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comment-automation/rules/:id`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 68. DELETE `/api/comment-automation/rule/:ruleId`

- **Category**: General Operations
- **HTTP Method**: `DELETE`
- **Route Path**: `/api/comment-automation/rule/:ruleId`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comment-automation/rule/:ruleId`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 69. DELETE `/api/comment-automation/rules/:id`

- **Category**: General Operations
- **HTTP Method**: `DELETE`
- **Route Path**: `/api/comment-automation/rules/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comment-automation/rules/:id`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 70. POST `/api/comment-automation/rules`

- **Category**: General Operations
- **HTTP Method**: `POST`
- **Route Path**: `/api/comment-automation/rules`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comment-automation/rules`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 71. GET `/api/comment-automation/rules/:id`

- **Category**: General Operations
- **HTTP Method**: `GET`
- **Route Path**: `/api/comment-automation/rules/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comment-automation/rules/:id`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 72. PATCH `/api/comment-automation/rules/:id`

- **Category**: General Operations
- **HTTP Method**: `PATCH`
- **Route Path**: `/api/comment-automation/rules/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comment-automation/rules/:id`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 73. DELETE `/api/comment-automation/rules/:id`

- **Category**: General Operations
- **HTTP Method**: `DELETE`
- **Route Path**: `/api/comment-automation/rules/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comment-automation/rules/:id`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 74. PATCH `/api/comment-automation/rules/:id/status`

- **Category**: General Operations
- **HTTP Method**: `PATCH`
- **Route Path**: `/api/comment-automation/rules/:id/status`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comment-automation/rules/:id/status`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 75. POST `/api/comment-automation/rules/:id/test`

- **Category**: General Operations
- **HTTP Method**: `POST`
- **Route Path**: `/api/comment-automation/rules/:id/test`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comment-automation/rules/:id/test`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 76. GET `/api/comment-automation/history`

- **Category**: General Operations
- **HTTP Method**: `GET`
- **Route Path**: `/api/comment-automation/history`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comment-automation/history`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 77. POST `/api/comment-automation/history/:id/retry`

- **Category**: General Operations
- **HTTP Method**: `POST`
- **Route Path**: `/api/comment-automation/history/:id/retry`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comment-automation/history/:id/retry`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 78. GET `/api/comment-automation/moderation`

- **Category**: General Operations
- **HTTP Method**: `GET`
- **Route Path**: `/api/comment-automation/moderation`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comment-automation/moderation`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 79. POST `/api/comment-automation/moderation/:id/action`

- **Category**: General Operations
- **HTTP Method**: `POST`
- **Route Path**: `/api/comment-automation/moderation/:id/action`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comment-automation/moderation/:id/action`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 80. GET `/api/comment-automation/stats`

- **Category**: General Operations
- **HTTP Method**: `GET`
- **Route Path**: `/api/comment-automation/stats`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/comment-automation/stats`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 81. POST `/api/auto-mod/rules`

- **Category**: Auto Moderation
- **HTTP Method**: `POST`
- **Route Path**: `/api/auto-mod/rules`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/auto-mod/rules`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 82. GET `/api/auto-mod/rules`

- **Category**: Auto Moderation
- **HTTP Method**: `GET`
- **Route Path**: `/api/auto-mod/rules`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/auto-mod/rules`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 83. PATCH `/api/auto-mod/rules/:id`

- **Category**: Auto Moderation
- **HTTP Method**: `PATCH`
- **Route Path**: `/api/auto-mod/rules/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/auto-mod/rules/:id`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 84. DELETE `/api/auto-mod/rules/:id`

- **Category**: Auto Moderation
- **HTTP Method**: `DELETE`
- **Route Path**: `/api/auto-mod/rules/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/auto-mod/rules/:id`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 85. PATCH `/api/auto-mod/rules/:id/status`

- **Category**: Auto Moderation
- **HTTP Method**: `PATCH`
- **Route Path**: `/api/auto-mod/rules/:id/status`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/auto-mod/rules/:id/status`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 86. GET `/api/auto-mod/comments`

- **Category**: Comments
- **HTTP Method**: `GET`
- **Route Path**: `/api/auto-mod/comments`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/auto-mod/comments`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 87. GET `/api/auto-mod/history`

- **Category**: Auto Moderation
- **HTTP Method**: `GET`
- **Route Path**: `/api/auto-mod/history`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/auto-mod/history`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 88. POST `/api/live-chat/toggle-mode`

- **Category**: General Operations
- **HTTP Method**: `POST`
- **Route Path**: `/api/live-chat/toggle-mode`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/live-chat/toggle-mode`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 89. GET `/api/live-chat/messages`

- **Category**: General Operations
- **HTTP Method**: `GET`
- **Route Path**: `/api/live-chat/messages`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/live-chat/messages`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 90. POST `/api/live-chat/send`

- **Category**: General Operations
- **HTTP Method**: `POST`
- **Route Path**: `/api/live-chat/send`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/live-chat/send`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 91. POST `/api/live-chat/sync`

- **Category**: General Operations
- **HTTP Method**: `POST`
- **Route Path**: `/api/live-chat/sync`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/live-chat/sync`
- **Access Level**: `Protected (JWT)`
- **Required Headers**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized"}
```

---

### 92. GET `/api/v1/admin/moderation/stats`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/v1/admin/moderation/stats`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/moderation/stats`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 93. POST `/api/v1/admin/login`

- **Category**: Admin Portal
- **HTTP Method**: `POST`
- **Route Path**: `/api/v1/admin/login`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/login`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `400` (EXPECTED AUTH GUARD)
- **Response Time**: `3ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Email and password are required."}
```

---

### 94. POST `/api/v1/admin/logout`

- **Category**: Admin Portal
- **HTTP Method**: `POST`
- **Route Path**: `/api/v1/admin/logout`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/logout`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `200` (EXPECTED AUTH GUARD)
- **Response Time**: `3ms`
- **Sample Body / Response**:
```json
{"success":true,"message":"Logged out successfully."}
```

---

### 95. GET `/api/v1/admin/me`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/v1/admin/me`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/me`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 96. GET `/api/v1/admin/profile`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/v1/admin/profile`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/profile`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 97. GET `/api/v1/admin/analytics`

- **Category**: Analytics & Dashboard
- **HTTP Method**: `GET`
- **Route Path**: `/api/v1/admin/analytics`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/analytics`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 98. GET `/api/v1/admin/audit-logs`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/v1/admin/audit-logs`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/audit-logs`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 99. POST `/api/v1/admin/clients`

- **Category**: Admin Portal
- **HTTP Method**: `POST`
- **Route Path**: `/api/v1/admin/clients`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/clients`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 100. GET `/api/v1/admin/clients`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/v1/admin/clients`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/clients`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 101. GET `/api/v1/admin/customers/details`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/v1/admin/customers/details`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/customers/details`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 102. GET `/api/v1/admin/clients/details/all`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/v1/admin/clients/details/all`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/clients/details/all`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 103. GET `/api/v1/admin/users/details/all`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/v1/admin/users/details/all`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/users/details/all`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 104. GET `/api/v1/admin/clients/:id`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/v1/admin/clients/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/clients/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 105. PUT `/api/v1/admin/clients/:id`

- **Category**: Admin Portal
- **HTTP Method**: `PUT`
- **Route Path**: `/api/v1/admin/clients/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/clients/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 106. PATCH `/api/v1/admin/clients/:id`

- **Category**: Admin Portal
- **HTTP Method**: `PATCH`
- **Route Path**: `/api/v1/admin/clients/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/clients/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 107. DELETE `/api/v1/admin/clients/:id`

- **Category**: Admin Portal
- **HTTP Method**: `DELETE`
- **Route Path**: `/api/v1/admin/clients/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/clients/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 108. GET `/api/v1/admin/users`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/v1/admin/users`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/users`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 109. GET `/api/v1/admin/users/:id`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/v1/admin/users/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/users/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 110. PATCH `/api/v1/admin/users/:id`

- **Category**: Admin Portal
- **HTTP Method**: `PATCH`
- **Route Path**: `/api/v1/admin/users/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/users/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 111. PUT `/api/v1/admin/users/:id`

- **Category**: Admin Portal
- **HTTP Method**: `PUT`
- **Route Path**: `/api/v1/admin/users/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/users/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 112. DELETE `/api/v1/admin/users/:id`

- **Category**: Admin Portal
- **HTTP Method**: `DELETE`
- **Route Path**: `/api/v1/admin/users/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/users/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 113. GET `/api/v1/admin/subscriptions`

- **Category**: Subscription & Payments
- **HTTP Method**: `GET`
- **Route Path**: `/api/v1/admin/subscriptions`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/subscriptions`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 114. POST `/api/v1/admin/subscriptions`

- **Category**: Subscription & Payments
- **HTTP Method**: `POST`
- **Route Path**: `/api/v1/admin/subscriptions`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/subscriptions`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 115. GET `/api/v1/admin/subscriptions/:id`

- **Category**: Subscription & Payments
- **HTTP Method**: `GET`
- **Route Path**: `/api/v1/admin/subscriptions/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/subscriptions/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 116. PATCH `/api/v1/admin/subscriptions/:id`

- **Category**: Subscription & Payments
- **HTTP Method**: `PATCH`
- **Route Path**: `/api/v1/admin/subscriptions/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/subscriptions/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 117. PUT `/api/v1/admin/subscriptions/:id`

- **Category**: Subscription & Payments
- **HTTP Method**: `PUT`
- **Route Path**: `/api/v1/admin/subscriptions/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/subscriptions/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 118. DELETE `/api/v1/admin/subscriptions/:id`

- **Category**: Subscription & Payments
- **HTTP Method**: `DELETE`
- **Route Path**: `/api/v1/admin/subscriptions/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/subscriptions/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `3ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 119. POST `/api/v1/admin/subscriptions/:userId/activate`

- **Category**: Subscription & Payments
- **HTTP Method**: `POST`
- **Route Path**: `/api/v1/admin/subscriptions/:userId/activate`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/subscriptions/:userId/activate`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 120. POST `/api/v1/admin/subscriptions/:id/activate`

- **Category**: Subscription & Payments
- **HTTP Method**: `POST`
- **Route Path**: `/api/v1/admin/subscriptions/:id/activate`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/subscriptions/:id/activate`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 121. POST `/api/v1/admin/subscriptions/:userId/cancel`

- **Category**: Subscription & Payments
- **HTTP Method**: `POST`
- **Route Path**: `/api/v1/admin/subscriptions/:userId/cancel`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/subscriptions/:userId/cancel`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 122. POST `/api/v1/admin/subscriptions/:id/cancel`

- **Category**: Subscription & Payments
- **HTTP Method**: `POST`
- **Route Path**: `/api/v1/admin/subscriptions/:id/cancel`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/subscriptions/:id/cancel`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 123. POST `/api/v1/admin/subscriptions/:userId/extend`

- **Category**: Subscription & Payments
- **HTTP Method**: `POST`
- **Route Path**: `/api/v1/admin/subscriptions/:userId/extend`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/subscriptions/:userId/extend`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 124. POST `/api/v1/admin/subscriptions/:id/extend`

- **Category**: Subscription & Payments
- **HTTP Method**: `POST`
- **Route Path**: `/api/v1/admin/subscriptions/:id/extend`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/subscriptions/:id/extend`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 125. GET `/api/v1/admin/admins`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/v1/admin/admins`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/admins`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 126. POST `/api/v1/admin/admins`

- **Category**: Admin Portal
- **HTTP Method**: `POST`
- **Route Path**: `/api/v1/admin/admins`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/admins`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 127. DELETE `/api/v1/admin/admins/:id`

- **Category**: Admin Portal
- **HTTP Method**: `DELETE`
- **Route Path**: `/api/v1/admin/admins/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/admins/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 128. GET `/api/v1/admin/payments`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/v1/admin/payments`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/payments`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 129. GET `/api/v1/admin/api-keys`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/v1/admin/api-keys`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/api-keys`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 130. POST `/api/v1/admin/api-keys`

- **Category**: Admin Portal
- **HTTP Method**: `POST`
- **Route Path**: `/api/v1/admin/api-keys`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/api-keys`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 131. DELETE `/api/v1/admin/api-keys/:id`

- **Category**: Admin Portal
- **HTTP Method**: `DELETE`
- **Route Path**: `/api/v1/admin/api-keys/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/v1/admin/api-keys/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 132. GET `/api/admin/moderation/stats`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/admin/moderation/stats`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/moderation/stats`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 133. POST `/api/admin/login`

- **Category**: Admin Portal
- **HTTP Method**: `POST`
- **Route Path**: `/api/admin/login`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/login`
- **Access Level**: `Public`
- **Required Headers**:
  - `Content-Type: application/json`
- **Live Test Status Code**: `400` (EXPECTED AUTH GUARD)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Email and password are required."}
```

---

### 134. POST `/api/admin/logout`

- **Category**: Admin Portal
- **HTTP Method**: `POST`
- **Route Path**: `/api/admin/logout`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/logout`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `200` (EXPECTED AUTH GUARD)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"success":true,"message":"Logged out successfully."}
```

---

### 135. GET `/api/admin/me`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/admin/me`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/me`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 136. GET `/api/admin/profile`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/admin/profile`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/profile`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 137. GET `/api/admin/analytics`

- **Category**: Analytics & Dashboard
- **HTTP Method**: `GET`
- **Route Path**: `/api/admin/analytics`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/analytics`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 138. GET `/api/admin/audit-logs`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/admin/audit-logs`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/audit-logs`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 139. POST `/api/admin/clients`

- **Category**: Admin Portal
- **HTTP Method**: `POST`
- **Route Path**: `/api/admin/clients`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/clients`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 140. GET `/api/admin/clients`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/admin/clients`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/clients`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 141. GET `/api/admin/customers/details`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/admin/customers/details`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/customers/details`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 142. GET `/api/admin/clients/details/all`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/admin/clients/details/all`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/clients/details/all`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 143. GET `/api/admin/users/details/all`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/admin/users/details/all`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/users/details/all`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 144. GET `/api/admin/clients/:id`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/admin/clients/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/clients/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 145. PUT `/api/admin/clients/:id`

- **Category**: Admin Portal
- **HTTP Method**: `PUT`
- **Route Path**: `/api/admin/clients/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/clients/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 146. PATCH `/api/admin/clients/:id`

- **Category**: Admin Portal
- **HTTP Method**: `PATCH`
- **Route Path**: `/api/admin/clients/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/clients/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 147. DELETE `/api/admin/clients/:id`

- **Category**: Admin Portal
- **HTTP Method**: `DELETE`
- **Route Path**: `/api/admin/clients/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/clients/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `3ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 148. GET `/api/admin/users`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/admin/users`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/users`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 149. GET `/api/admin/users/:id`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/admin/users/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/users/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 150. PATCH `/api/admin/users/:id`

- **Category**: Admin Portal
- **HTTP Method**: `PATCH`
- **Route Path**: `/api/admin/users/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/users/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 151. PUT `/api/admin/users/:id`

- **Category**: Admin Portal
- **HTTP Method**: `PUT`
- **Route Path**: `/api/admin/users/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/users/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 152. DELETE `/api/admin/users/:id`

- **Category**: Admin Portal
- **HTTP Method**: `DELETE`
- **Route Path**: `/api/admin/users/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/users/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 153. GET `/api/admin/subscriptions`

- **Category**: Subscription & Payments
- **HTTP Method**: `GET`
- **Route Path**: `/api/admin/subscriptions`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/subscriptions`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 154. POST `/api/admin/subscriptions`

- **Category**: Subscription & Payments
- **HTTP Method**: `POST`
- **Route Path**: `/api/admin/subscriptions`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/subscriptions`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 155. GET `/api/admin/subscriptions/:id`

- **Category**: Subscription & Payments
- **HTTP Method**: `GET`
- **Route Path**: `/api/admin/subscriptions/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/subscriptions/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 156. PATCH `/api/admin/subscriptions/:id`

- **Category**: Subscription & Payments
- **HTTP Method**: `PATCH`
- **Route Path**: `/api/admin/subscriptions/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/subscriptions/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 157. PUT `/api/admin/subscriptions/:id`

- **Category**: Subscription & Payments
- **HTTP Method**: `PUT`
- **Route Path**: `/api/admin/subscriptions/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/subscriptions/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 158. DELETE `/api/admin/subscriptions/:id`

- **Category**: Subscription & Payments
- **HTTP Method**: `DELETE`
- **Route Path**: `/api/admin/subscriptions/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/subscriptions/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 159. POST `/api/admin/subscriptions/:userId/activate`

- **Category**: Subscription & Payments
- **HTTP Method**: `POST`
- **Route Path**: `/api/admin/subscriptions/:userId/activate`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/subscriptions/:userId/activate`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 160. POST `/api/admin/subscriptions/:id/activate`

- **Category**: Subscription & Payments
- **HTTP Method**: `POST`
- **Route Path**: `/api/admin/subscriptions/:id/activate`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/subscriptions/:id/activate`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 161. POST `/api/admin/subscriptions/:userId/cancel`

- **Category**: Subscription & Payments
- **HTTP Method**: `POST`
- **Route Path**: `/api/admin/subscriptions/:userId/cancel`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/subscriptions/:userId/cancel`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 162. POST `/api/admin/subscriptions/:id/cancel`

- **Category**: Subscription & Payments
- **HTTP Method**: `POST`
- **Route Path**: `/api/admin/subscriptions/:id/cancel`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/subscriptions/:id/cancel`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 163. POST `/api/admin/subscriptions/:userId/extend`

- **Category**: Subscription & Payments
- **HTTP Method**: `POST`
- **Route Path**: `/api/admin/subscriptions/:userId/extend`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/subscriptions/:userId/extend`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 164. POST `/api/admin/subscriptions/:id/extend`

- **Category**: Subscription & Payments
- **HTTP Method**: `POST`
- **Route Path**: `/api/admin/subscriptions/:id/extend`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/subscriptions/:id/extend`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 165. GET `/api/admin/admins`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/admin/admins`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/admins`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 166. POST `/api/admin/admins`

- **Category**: Admin Portal
- **HTTP Method**: `POST`
- **Route Path**: `/api/admin/admins`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/admins`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 167. DELETE `/api/admin/admins/:id`

- **Category**: Admin Portal
- **HTTP Method**: `DELETE`
- **Route Path**: `/api/admin/admins/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/admins/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 168. GET `/api/admin/payments`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/admin/payments`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/payments`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 169. GET `/api/admin/api-keys`

- **Category**: Admin Portal
- **HTTP Method**: `GET`
- **Route Path**: `/api/admin/api-keys`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/api-keys`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `3ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 170. POST `/api/admin/api-keys`

- **Category**: Admin Portal
- **HTTP Method**: `POST`
- **Route Path**: `/api/admin/api-keys`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/api-keys`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 171. DELETE `/api/admin/api-keys/:id`

- **Category**: Admin Portal
- **HTTP Method**: `DELETE`
- **Route Path**: `/api/admin/api-keys/:id`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/admin/api-keys/:id`
- **Access Level**: `Admin Only`
- **Required Headers**:
  - `Authorization: Bearer <adminToken>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"success":false,"error":"Unauthorized: Admin token is missing."}
```

---

### 172. GET `/api/external/leads`

- **Category**: External APIs
- **HTTP Method**: `GET`
- **Route Path**: `/api/external/leads`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/external/leads`
- **Access Level**: `External API Key`
- **Required Headers**:
  - `x-api-key: <EXTERNAL_ADMIN_API_KEY>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized: API Key is missing. Provide x-api-key header or Bearer token."}
```

---

### 173. POST `/api/external/leads`

- **Category**: External APIs
- **HTTP Method**: `POST`
- **Route Path**: `/api/external/leads`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/external/leads`
- **Access Level**: `External API Key`
- **Required Headers**:
  - `x-api-key: <EXTERNAL_ADMIN_API_KEY>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized: API Key is missing. Provide x-api-key header or Bearer token."}
```

---

### 174. GET `/api/external/users`

- **Category**: External APIs
- **HTTP Method**: `GET`
- **Route Path**: `/api/external/users`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/external/users`
- **Access Level**: `External API Key`
- **Required Headers**:
  - `x-api-key: <EXTERNAL_ADMIN_API_KEY>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `1ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized: API Key is missing. Provide x-api-key header or Bearer token."}
```

---

### 175. GET `/api/external/customers/details`

- **Category**: External APIs
- **HTTP Method**: `GET`
- **Route Path**: `/api/external/customers/details`
- **Full Production URL**: `https://server-youtube-auto.onrender.com/api/external/customers/details`
- **Access Level**: `External API Key`
- **Required Headers**:
  - `x-api-key: <EXTERNAL_ADMIN_API_KEY>`
  - `Content-Type: application/json`
- **Live Test Status Code**: `401` (PASS)
- **Response Time**: `2ms`
- **Sample Body / Response**:
```json
{"error":"Unauthorized: API Key is missing. Provide x-api-key header or Bearer token."}
```

---

