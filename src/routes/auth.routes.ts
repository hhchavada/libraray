import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import { authValidation } from '../validations/auth.validation';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.post('/register', validate(authValidation.register), authController.register);
router.post('/verify-email', validate(authValidation.verifyEmail), authController.verifyEmail);
router.post('/resend-otp', validate(authValidation.resendOtp), authController.resendVerificationOtp);
router.post('/forgot-password', validate(authValidation.forgotPassword), authController.forgotPassword);
router.post(
  '/verify-forgot-password-otp',
  validate(authValidation.verifyForgotPasswordOtp),
  authController.verifyForgotPasswordOtp
);
router.post('/reset-password', validate(authValidation.resetPassword), authController.resetPassword);
router.post('/login', validate(authValidation.login), authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/logout', protect, authController.logout);

export default router;
