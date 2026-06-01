# Library Subscription API

Base URL: `/api/v1`

All authenticated routes require header: `Authorization: Bearer <access_token>`

## Environment variables

```env
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_secret
MONGO_URI=mongodb://localhost:27017/library-management
```

Seed plans:

```bash
npm run seed:subscription-plans
```

Plans are **auto-synced to MongoDB on server start** (16 documents). You can also run `npm run seed:subscription-plans` manually.

---

## Public / Owner APIs

### GET `/subscription/plans`

Returns active plans grouped by category.

**Response `data`:**

```json
{
  "Small": [ { "_id": "...", "name": "...", "amount": 199, "durationType": "monthly", ... } ],
  "Medium": [ ... ],
  "Large": [ ... ],
  "Mega": [ ... ]
}
```

---

### POST `/subscription/create-order` (auth)

**Body:**

```json
{
  "planId": "507f1f77bcf86cd799439011",
  "confirmReplace": false
}
```

- If the user has an active subscription on a **different** plan, returns `409` unless `confirmReplace: true`.
- Same plan while active: order is created for **extension** (extra months added on verify).

**Response `data`:**

```json
{
  "orderId": "order_xxxxx",
  "amount": 19900,
  "currency": "INR",
  "key": "rzp_test_xxxxx",
  "subscriptionId": "...",
  "paymentUrl": "https://rzp.io/l/xxxxxx",
  "paymentLinkId": "plink_xxxxx"
}
```

- **`paymentUrl`** — Razorpay hosted payment page. Open this link in browser to pay (no app checkout UI required).
- **`amount`** is in **paise** (Razorpay format).

After successful payment via link, Razorpay redirects to  
`GET /api/v1/subscription/payment-callback` and the subscription is activated automatically.

---

### POST `/subscription/verify-payment` (auth)

**Body:**

```json
{
  "razorpay_order_id": "order_xxxxx",
  "razorpay_payment_id": "pay_xxxxx",
  "razorpay_signature": "signature_hex"
}
```

Verifies HMAC signature, activates subscription, sets `startDate` / `endDate`.

Idempotent: repeating the same paid `razorpay_payment_id` returns the existing subscription.

**Response `data`:** activated subscription document with populated `planId`.

---

### GET `/subscription/current` (auth)

Returns the user's active subscription (or `null`).

---

### GET `/subscription/history` (auth)

Returns all subscription records for the user, newest first.

---

## Admin APIs (super_admin)

### POST `/admin/subscription/plans`

Create a plan.

### PUT `/admin/subscription/plans/:planId`

Update plan fields.

### PATCH `/admin/subscription/plans/:planId/disable`

Sets `isActive: false`.

### GET `/admin/subscriptions`

Query: `?status=active&paymentStatus=paid`

Lists all subscriptions with user and plan populated.

---

## Plan catalogue (seeded)

| Category | Seats | Monthly | Quarterly | Half Yearly | Annually |
|----------|-------|---------|-----------|-------------|----------|
| Small | ≤50 | ₹199 | ₹499 | ₹899 | ₹1699 |
| Medium | 51–100 | ₹259 | ₹649 | ₹1199 | ₹2199 |
| Large | 101–150 | ₹349 | ₹899 | ₹1599 | ₹2999 |
| Mega | 151+ | ₹449 | ₹1099 | ₹1999 | ₹3599 |

Duration months: 1 / 3 / 6 / 12 respectively.

---

## Razorpay checkout (frontend)

1. `POST /subscription/create-order`
2. Open Razorpay Checkout with `key`, `order_id`, `amount`, `currency`
3. On success handler → `POST /subscription/verify-payment`
4. `GET /subscription/current` to refresh status

See `public/subscription.html` for a working reference implementation.
