// One-time passwords for phone login (customers and riders share the same rules).
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { env } from '../config/env.js';
import { Otp } from '../models/index.js';
import { badRequest } from './http.js';
import { failureLimiter } from './rate-limit.js';

export const phoneSchema = z.string().regex(/^\+91[6-9]\d{9}$/, 'Enter a valid Indian mobile number');
const DEV_OTP = '1234';

// On top of the 5-tries-per-OTP lock: 8 wrong codes for a number in 10 minutes → wait (stops guessing across new OTPs)
const otpLimit = failureLimiter({ max: 8, windowMs: 10 * 60 * 1000, message: 'Too many wrong OTPs.' });

/** Throws a clear 4xx if the code is wrong, expired or guessed too often. */
export async function checkOtp(phone: string, code: string) {
  otpLimit.assertAllowed(phone);
  if (env.OTP_DEV_MODE) {
    if (code !== DEV_OTP) {
      otpLimit.fail(phone);
      throw badRequest('WRONG_OTP', 'Wrong OTP. In test mode the OTP is 1234.');
    }
  } else {
    const otp = await Otp.findOne({ phone }).sort({ createdAt: -1 });
    if (!otp || otp.expiresAt < new Date()) throw badRequest('OTP_EXPIRED', 'OTP expired. Please request a new one.');
    if (otp.attempts >= 5) throw badRequest('OTP_LOCKED', 'Too many wrong attempts. Request a new OTP.');
    if (!(await bcrypt.compare(code, otp.codeHash))) {
      otp.attempts += 1;
      await otp.save();
      otpLimit.fail(phone);
      throw badRequest('WRONG_OTP', 'Wrong OTP. Please try again.');
    }
    await Otp.deleteMany({ phone });
  }
  otpLimit.succeed(phone);
}
