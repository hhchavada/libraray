import Joi from 'joi';

export const authValidation = {
  register: Joi.object({
    fullName: Joi.string().min(2).required(),
    email: Joi.string().email().required(),
    mobileNumber: Joi.string()
      .pattern(/^[0-9]{10}$/)
      .required(),
    password: Joi.string().min(6).max(20).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  verifyEmail: Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).pattern(/^[0-9]+$/).required(),
  }),

  resendOtp: Joi.object({
    email: Joi.string().email().required(),
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required(),
  }),

  verifyForgotPasswordOtp: Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).pattern(/^[0-9]+$/).required(),
  }),

  resetPassword: Joi.object({
    resetToken: Joi.string().required(),
    password: Joi.string().min(6).max(20).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
  }),
};
