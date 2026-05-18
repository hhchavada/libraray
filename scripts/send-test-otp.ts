import 'dotenv/config';
import { connectDB } from '../src/config/db';
import { ENV } from '../src/config/env';
import { otpService } from '../src/services/otp.service';
import { OtpType } from '../src/constants/enums';

const email = process.argv[2];

if (!email) {
  console.error('Usage: npx ts-node scripts/send-test-otp.ts <email>');
  process.exit(1);
}

const run = async () => {
  console.log('SMTP_USER:', ENV.SMTP_USER ? 'set' : 'missing');
  console.log('SMTP_PASS:', ENV.SMTP_PASS ? 'set' : 'missing');

  await connectDB();
  await otpService.createAndSendOtp(email, OtpType.EMAIL_VERIFICATION);
  console.log(`OTP sent to ${email}`);
  process.exit(0);
};

run().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
