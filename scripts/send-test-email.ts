import 'dotenv/config';
import { emailService } from '../src/services/email.service';

const email = process.argv[2] || 'harshchavada174@gmail.com';
const otp = Math.floor(100000 + Math.random() * 900000).toString();

emailService
  .sendOtpEmail(email, otp, 'verification')
  .then(() => {
    console.log(`Test OTP ${otp} sent to ${email}`);
    process.exit(0);
  })
  .catch((err: Error) => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
