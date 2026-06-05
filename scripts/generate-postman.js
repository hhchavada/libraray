const fs = require('fs');

const loginScript = {
  listen: 'test',
  script: {
    type: 'text/javascript',
    exec: [
      'if (pm.response.code === 200) {',
      '  const res = pm.response.json();',
      '  if (res.data && res.data.accessToken) {',
      "    pm.collectionVariables.set('accessToken', res.data.accessToken);",
      '  }',
      '}',
    ],
  },
};

const libraryScript = {
  listen: 'test',
  script: {
    type: 'text/javascript',
    exec: [
      'if (pm.response.code === 201 || pm.response.code === 200) {',
      '  const res = pm.response.json();',
      '  if (res.data && res.data._id) {',
      "    pm.collectionVariables.set('libraryId', res.data._id);",
      '  }',
      '  if (res.data && res.data.qrCodeId) {',
      "    pm.collectionVariables.set('qrCodeId', res.data.qrCodeId);",
      '  }',
      '}',
    ],
  },
};

const memberScript = {
  listen: 'test',
  script: {
    type: 'text/javascript',
    exec: [
      'if (pm.response.code === 201) {',
      '  const res = pm.response.json();',
      '  if (res.data && res.data._id) {',
      "    pm.collectionVariables.set('memberId', res.data._id);",
      '  }',
      '}',
    ],
  },
};

const resetTokenScript = {
  listen: 'test',
  script: {
    type: 'text/javascript',
    exec: [
      'if (pm.response.code === 200) {',
      '  const res = pm.response.json();',
      '  if (res.data && res.data.resetToken) {',
      "    pm.collectionVariables.set('resetToken', res.data.resetToken);",
      '  }',
      '}',
    ],
  },
};

const seatScript = {
  listen: 'test',
  script: {
    type: 'text/javascript',
    exec: [
      'if (pm.response.code === 200) {',
      '  const res = pm.response.json();',
      '  if (Array.isArray(res.data) && res.data[0] && res.data[0]._id) {',
      "    pm.collectionVariables.set('seatId', res.data[0]._id);",
      '  }',
      '}',
    ],
  },
};

const expenseScript = {
  listen: 'test',
  script: {
    type: 'text/javascript',
    exec: [
      'if (pm.response.code === 201) {',
      '  const res = pm.response.json();',
      '  if (res.data && res.data._id) {',
      "    pm.collectionVariables.set('expenseId', res.data._id);",
      '  }',
      '}',
    ],
  },
};

const planIdScript = {
  listen: 'test',
  script: {
    type: 'text/javascript',
    exec: [
      'if (pm.response.code === 200) {',
      '  const res = pm.response.json();',
      '  const data = res.data || {};',
      '  const pick = data.Small?.[0] || data.Medium?.[0] || data.Large?.[0] || data.Mega?.[0];',
      '  if (pick && pick._id) {',
      "    pm.collectionVariables.set('planId', pick._id);",
      '  }',
      '}',
    ],
  },
};

const subscriptionOrderScript = {
  listen: 'test',
  script: {
    type: 'text/javascript',
    exec: [
      'if (pm.response.code === 201) {',
      '  const d = pm.response.json().data;',
      '  if (d) {',
      "    if (d.orderId) pm.collectionVariables.set('razorpayOrderId', d.orderId);",
      "    if (d.subscriptionId) pm.collectionVariables.set('subscriptionId', d.subscriptionId);",
      "    if (d.key) pm.collectionVariables.set('razorpayKey', d.key);",
      '    if (d.paymentUrl) console.log("Open payment URL:", d.paymentUrl);',
      '  }',
      '}',
    ],
  },
};

const req = (name, method, url, opts = {}) => {
  const item = {
    name,
    request: {
      method,
      header: opts.headers || [],
      url,
      description: opts.desc || '',
    },
  };

  if (opts.body) {
    item.request.header.push({ key: 'Content-Type', value: 'application/json' });
    item.request.body = { mode: 'raw', raw: JSON.stringify(opts.body, null, 2) };
  }

  if (opts.auth === false) {
    item.request.auth = { type: 'noauth' };
  }

  if (opts.event) {
    item.event = opts.event;
  }

  return item;
};

const b = '{{baseUrl}}';
const api = `${b}/api/v1`;

const collection = {
  info: {
    _postman_id: 'lms-api-v2-full',
    name: 'Library Management System API v3',
    description:
      'Complete LMS API (updated).\n\nSetup:\n1. Import environment (Local or Production)\n2. Auth > Login (saves accessToken)\n3. Library > Get My Library or Create Library (saves libraryId, qrCodeId)\n4. Members / Subscription / other folders\n\nSubscription: open paymentUrl from Create Order in browser.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:5000' },
    { key: 'accessToken', value: '' },
    { key: 'libraryId', value: '' },
    { key: 'qrCodeId', value: '' },
    { key: 'memberId', value: '' },
    { key: 'seatId', value: '' },
    { key: 'expenseId', value: '' },
    { key: 'planId', value: '' },
    { key: 'resetToken', value: '' },
    { key: 'razorpayOrderId', value: '' },
    { key: 'razorpayPaymentId', value: '' },
    { key: 'razorpaySignature', value: '' },
    { key: 'razorpayKey', value: '' },
    { key: 'subscriptionId', value: '' },
    { key: 'subscriptionPlanId', value: '' },
  ],
  item: [
    {
      name: '00 - Public (QR Scan)',
      item: [
        req('Open Scan Page', 'GET', `${b}/scan?libraryId={{libraryId}}&qrCodeId={{qrCodeId}}`, {
          auth: false,
          desc: 'Open in browser for student registration form',
        }),
        req('Get Library Info', 'GET', `${api}/public/scan/library?libraryId={{libraryId}}&qrCodeId={{qrCodeId}}`, {
          auth: false,
        }),
        req('Register Demo Student (QR)', 'POST', `${api}/public/scan/register`, {
          auth: false,
          body: {
            libraryId: '{{libraryId}}',
            qrCodeId: '{{qrCodeId}}',
            fullName: 'QR Student',
            mobileNumber: '9876543210',
            shiftType: 'morning',
            startDate: '2025-05-01T00:00:00.000Z',
            endDate: '2025-05-08T00:00:00.000Z',
            courseName: 'UPSC',
            email: 'student@example.com',
          },
          event: [memberScript],
        }),
      ],
    },
    {
      name: '01 - Auth',
      item: [
        req('Register', 'POST', `${api}/auth/register`, {
          auth: false,
          body: {
            fullName: 'John Owner',
            email: 'owner@library.com',
            mobileNumber: '9876543210',
            password: 'password123',
            confirmPassword: 'password123',
          },
        }),
        req('Verify Email OTP', 'POST', `${api}/auth/verify-email`, {
          auth: false,
          body: { email: 'owner@library.com', otp: '123456' },
          event: [loginScript],
        }),
        req('Resend OTP', 'POST', `${api}/auth/resend-otp`, {
          auth: false,
          body: { email: 'owner@library.com' },
        }),
        req('Login', 'POST', `${api}/auth/login`, {
          auth: false,
          body: { email: 'owner@library.com', password: 'password123' },
          event: [loginScript],
        }),
        req('Refresh Token', 'POST', `${api}/auth/refresh`, { auth: false, body: {} }),
        req('Forgot Password', 'POST', `${api}/auth/forgot-password`, {
          auth: false,
          body: { email: 'owner@library.com' },
        }),
        req('Verify Forgot Password OTP', 'POST', `${api}/auth/verify-forgot-password-otp`, {
          auth: false,
          body: { email: 'owner@library.com', otp: '123456' },
          event: [resetTokenScript],
        }),
        req('Reset Password', 'POST', `${api}/auth/reset-password`, {
          auth: false,
          body: {
            resetToken: '{{resetToken}}',
            password: 'newpass123',
            confirmPassword: 'newpass123',
          },
        }),
        req('Logout', 'POST', `${api}/auth/logout`, {}),
      ],
    },
    {
      name: '02 - Library',
      item: [
        req('Create Library (Default Seats)', 'POST', `${api}/library`, {
          body: {
            libraryName: 'Central Study Library',
            address: '123 Main St, Ahmedabad',
            seatMapType: 'default',
            totalSeats: 50,
          },
          event: [libraryScript],
        }),
        req('Create Library (Custom Seats)', 'POST', `${api}/library`, {
          body: {
            libraryName: 'Central Study Library',
            address: '123 Main St, Ahmedabad',
            seatMapType: 'custom',
            selectedSeats: [
              { seatNumber: 1, row: 2, column: 0 },
              { seatNumber: 2, row: 1, column: 3 },
              { seatNumber: 3, row: 5, column: 4 },
            ],
          },
          event: [libraryScript],
        }),
        req('Get My Library', 'GET', `${api}/library`, { event: [libraryScript] }),
        req('Update Library', 'PUT', `${api}/library`, {
          body: { libraryName: 'Central Study Library Updated' },
        }),
        req('Get Library Stats', 'GET', `${api}/library/stats`, {}),
        req('Get Library QR', 'GET', `${api}/library/qr`, { event: [libraryScript] }),
      ],
    },
    {
      name: '03 - Seats',
      item: [
        req('Get All Seats', 'GET', `${api}/seats/{{libraryId}}/all`, { event: [seatScript] }),
        req('Get Available Seats', 'GET', `${api}/seats/{{libraryId}}/available?shift=morning`, {}),
        req('Get Seats By Shift', 'GET', `${api}/seats/{{libraryId}}/by-shift`, {}),
        req('Lock Seat', 'POST', `${api}/seats/lock/{{seatId}}`, {
          body: { memberId: '{{memberId}}' },
        }),
        req('Release Seat', 'POST', `${api}/seats/release/{{seatId}}`, {}),
      ],
    },
    {
      name: '04 - Admin (Super Admin)',
      item: [
        req('Admin Dashboard', 'GET', `${api}/admin/dashboard`, {}),
        req('Admin Library Detail', 'GET', `${api}/admin/libraries/{{libraryId}}`, {}),
        req('Create Subscription Plan', 'POST', `${api}/admin/subscription/plans`, {
          body: {
            name: 'Small Library — Monthly',
            category: 'small',
            seatsMin: 1,
            seatsMax: 50,
            durationType: 'monthly',
            durationMonths: 1,
            amount: 199,
          },
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'if (pm.response.code === 201) {',
                  '  const res = pm.response.json();',
                  '  if (res.data && res.data._id) {',
                  "    pm.collectionVariables.set('subscriptionPlanId', res.data._id);",
                  '  }',
                  '}',
                ],
              },
            },
          ],
        }),
        req('Update Subscription Plan', 'PUT', `${api}/admin/subscription/plans/{{subscriptionPlanId}}`, {
          body: { amount: 249 },
        }),
        req('Disable Subscription Plan', 'PATCH', `${api}/admin/subscription/plans/{{subscriptionPlanId}}/disable`, {}),
        req('Get All Subscriptions (Admin)', 'GET', `${api}/admin/subscriptions`, {}),
      ],
    },
    {
      name: '05 - Members',
      item: [
        req('Create Member (Permanent)', 'POST', `${api}/members`, {
          body: {
            type: 'permanent',
            fullName: 'Rahul Sharma',
            mobileNumber: '9123456789',
            membershipPlan: '1_month',
            shiftType: 'morning',
            startDate: '2025-05-01T00:00:00.000Z',
            endDate: '2025-06-01T00:00:00.000Z',
            feePerMonth: 2000,
            discount: 10,
            paymentStatus: 'partial',
            paymentMode: 'upi',
            amountPaid: 1500,
            seatId: '{{seatId}}',
            email: 'rahul@example.com',
          },
          event: [memberScript],
        }),
        req('Create Member (Demo)', 'POST', `${api}/members`, {
          desc: 'endDate is optional for demo — omit it or send null.',
          body: {
            type: 'demo',
            fullName: 'Demo Student',
            mobileNumber: '9988776655',
            shiftType: 'evening',
            startDate: '2025-05-01T00:00:00.000Z',
          },
          event: [memberScript],
        }),
        req('Create Member (Without Seat)', 'POST', `${api}/members`, {
          body: {
            type: 'without-seat',
            fullName: 'Priya Patel',
            mobileNumber: '9111222333',
            membershipPlan: '3_months',
            shiftType: 'full_day',
            startDate: '2025-05-01T00:00:00.000Z',
            endDate: '2025-08-01T00:00:00.000Z',
            feePerMonth: 1500,
            paymentStatus: 'paid',
            paymentMode: 'cash',
            amountPaid: 4500,
          },
        }),
        req('Get All Members', 'GET', `${api}/members?page=1&limit=10&sort=newest`, {}),
        req('Get Member By ID', 'GET', `${api}/members/{{memberId}}`, {
          desc: 'Response always includes email and remarks (empty string if not set).',
        }),
        req('Update Member', 'PUT', `${api}/members/{{memberId}}`, {
          body: { fullName: 'Rahul Updated', email: 'rahul@example.com' },
        }),
        req('Convert Demo to Permanent', 'POST', `${api}/members/{{memberId}}/convert-to-permanent`, {
          desc: 'Converts a demo member to permanent with plan, fees, endDate, and optional seatId, shiftType, and startDate.',
          body: {
            membershipPlan: '1_month',
            feePerMonth: 2000,
            discount: 0,
            endDate: '2025-06-01T00:00:00.000Z',
            amountPaid: 2000,
            paymentMode: 'upi',
            seatId: '{{seatId}}',
            shiftType: 'morning',
            startDate: '2025-05-01T00:00:00.000Z',
          },
          event: [memberScript],
        }),
        req('Renew Member Plan', 'POST', `${api}/members/{{memberId}}/renew`, {
          desc: 'Extends endDate by membership plan (1_month, 2_months, etc.). Demo members cannot renew.',
          body: {
            amountPaid: 1500,
            paymentMode: 'cash',
            membershipPlan: '1_month',
          },
          event: [memberScript],
        }),
        req('Assign Seat (without_seat member)', 'POST', `${api}/members/{{memberId}}/assign-seat`, {
          body: { seatId: '{{seatId}}', shiftType: 'morning' },
        }),
        req('Change Seat', 'POST', `${api}/members/{{memberId}}/change-seat`, {
          body: { seatId: '{{seatId}}', shiftType: 'evening' },
        }),
        req('Delete Member', 'DELETE', `${api}/members/{{memberId}}`, {}),
      ],
    },
    {
      name: '05 - Dashboard',
      item: [req('Get Dashboard Stats', 'GET', `${api}/dashboard/stats/{{libraryId}}`, {})],
    },
    {
      name: '06 - Revenue',
      item: [
        req('Revenue Summary', 'GET', `${api}/revenue/summary/{{libraryId}}?filter=this_month`, {}),
        req('Revenue By Mode', 'GET', `${api}/revenue/by-mode/{{libraryId}}?filter=this_month`, {}),
        req('Revenue Trend', 'GET', `${api}/revenue/trend/{{libraryId}}`, {}),
      ],
    },
    {
      name: '07 - Expenses',
      item: [
        req('Create Expense', 'POST', `${api}/expenses`, {
          body: {
            libraryId: '{{libraryId}}',
            expenseDate: '2025-05-15T00:00:00.000Z',
            description: 'Electricity bill',
            amount: 3500,
            category: 'electricity',
          },
          event: [expenseScript],
        }),
        req('Get All Expenses', 'GET', `${api}/expenses?libraryId={{libraryId}}&page=1&limit=10`, {}),
        req('Expense Summary', 'GET', `${api}/expenses/summary?libraryId={{libraryId}}&filter=this_month`, {}),
        req('Get Expense By ID', 'GET', `${api}/expenses/{{expenseId}}?libraryId={{libraryId}}`, {}),
        req('Update Expense', 'PUT', `${api}/expenses/{{expenseId}}?libraryId={{libraryId}}`, {
          body: { amount: 3800 },
        }),
        req('Delete Expense', 'DELETE', `${api}/expenses/{{expenseId}}?libraryId={{libraryId}}`, {}),
      ],
    },
    {
      name: '08 - Reports',
      item: [
        req('Member Report JSON', 'GET', `${api}/reports/members/{{libraryId}}?format=json`, {}),
        req('Member Report Excel', 'GET', `${api}/reports/members/{{libraryId}}?format=excel`, {}),
        req('Member Report PDF', 'GET', `${api}/reports/members/{{libraryId}}?format=pdf`, {}),
      ],
    },
    {
      name: '09 - Subscription (Library Owner)',
      item: [
        req('Get Plans (Grouped)', 'GET', `${api}/subscription/plans`, {
          auth: false,
          event: [planIdScript],
        }),
        req('Create Razorpay Order', 'POST', `${api}/subscription/create-order`, {
          body: { planId: '{{planId}}', confirmReplace: false },
          desc: 'Returns paymentUrl — open in browser for Razorpay hosted checkout.',
          event: [subscriptionOrderScript],
        }),
        req('Create Order (Replace Plan)', 'POST', `${api}/subscription/create-order`, {
          body: { planId: '{{planId}}', confirmReplace: true },
          event: [subscriptionOrderScript],
        }),
        req('Verify Payment', 'POST', `${api}/subscription/verify-payment`, {
          body: {
            razorpay_order_id: '{{razorpayOrderId}}',
            razorpay_payment_id: '{{razorpayPaymentId}}',
            razorpay_signature: '{{razorpaySignature}}',
          },
        }),
        req('Get Current Subscription', 'GET', `${api}/subscription/current`, {}),
        req('Get Subscription History', 'GET', `${api}/subscription/history`, {}),
        req('Payment Callback (Browser)', 'GET', `${api}/subscription/payment-callback`, {
          auth: false,
          desc: 'Razorpay redirects here after Payment Link success (query params auto).',
        }),
      ],
    },
  ],
};

fs.writeFileSync(
  'postman/Library-Management-System.postman_collection.json',
  JSON.stringify(collection, null, 2)
);

const envVars = [
  { key: 'baseUrl', value: 'http://localhost:5000', enabled: true },
  { key: 'accessToken', value: '', enabled: true },
  { key: 'libraryId', value: '', enabled: true },
  { key: 'qrCodeId', value: '', enabled: true },
  { key: 'memberId', value: '', enabled: true },
  { key: 'seatId', value: '', enabled: true },
  { key: 'expenseId', value: '', enabled: true },
  { key: 'planId', value: '', enabled: true },
  { key: 'subscriptionPlanId', value: '', enabled: true },
  { key: 'resetToken', value: '', enabled: true },
  { key: 'razorpayOrderId', value: '', enabled: true },
  { key: 'razorpayPaymentId', value: '', enabled: true },
  { key: 'razorpaySignature', value: '', enabled: true },
  { key: 'razorpayKey', value: '', enabled: true },
  { key: 'subscriptionId', value: '', enabled: true },
];

fs.writeFileSync(
  'postman/Library-Management-System.postman_environment.json',
  JSON.stringify(
    {
      id: 'lms-env-local',
      name: 'LMS — Local',
      values: envVars,
      _postman_variable_scope: 'environment',
    },
    null,
    2
  )
);

fs.writeFileSync(
  'postman/Library-Management-System.postman_environment.production.json',
  JSON.stringify(
    {
      id: 'lms-env-production',
      name: 'LMS — Production (Render)',
      values: envVars.map((v) =>
        v.key === 'baseUrl'
          ? { ...v, value: 'https://libraray-gemm.onrender.com' }
          : { ...v }
      ),
      _postman_variable_scope: 'environment',
    },
    null,
    2
  )
);

console.log('Postman collection + environments generated successfully');
