import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getEnv } from '../config/env';
import { User, serializeUser } from '../models';
import { ApiError } from '../utils/ApiError';
import { signAccessToken } from '../utils/jwt';
import type { AuthenticatedRequest } from '../middlewares/rateLimiter';
import type { LoginInput, RegisterInput, UpdateProfileInput } from '../validators/authValidator';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { full_name, email, password } = req.body as RegisterInput;

    const existing = await User.findOne({ email });
    if (existing) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Data yang dikirim tidak valid.', {
        email: ['Email sudah terdaftar.'],
      });
    }

    const env = getEnv();
    const passwordHash = await bcrypt.hash(password, env.bcryptSaltRounds);

    // Registration ALWAYS forces role: "user" (AGENTS.md rule 6, API_SPECS §4.1)
    const user = await User.create({
      full_name,
      email,
      password_hash: passwordHash,
      role: 'user',
      is_active: true,
    });

    const token = signAccessToken({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: serializeUser(user),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as LoginInput;

    const user = await User.findOne({ email }).select('+password_hash');
    const isValid = user && user.is_active && (await bcrypt.compare(password, user.password_hash));

    if (!isValid || !user) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Email atau password salah.');
    }

    const token = signAccessToken({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    res.status(200).json({
      success: true,
      data: {
        token,
        user: serializeUser(user),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Sesi tidak valid.');
    }
    res.status(200).json({
      success: true,
      data: {
        user: serializeUser(user),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateMe(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = req.body as UpdateProfileInput;
    const user = await User.findById(req.user?.id).select('+password_hash');
    if (!user) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Sesi tidak valid.');
    }

    if (input.full_name !== undefined) {
      user.full_name = input.full_name;
    }

    if (input.username !== undefined && input.username !== user.username) {
      const conflict = await User.findOne({
        username: input.username,
        _id: { $ne: user._id },
      });
      if (conflict) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Data yang dikirim tidak valid.', {
          username: ['Username sudah digunakan.'],
        });
      }
      user.username = input.username;
    }

    if (input.avatar !== undefined) {
      user.avatar = input.avatar;
    }

    if (input.new_password) {
      const currentMatches =
        input.current_password !== undefined &&
        (await bcrypt.compare(input.current_password, user.password_hash));
      if (!currentMatches) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Data yang dikirim tidak valid.', {
          current_password: ['Kata sandi saat ini tidak sesuai.'],
        });
      }
      const env = getEnv();
      user.password_hash = await bcrypt.hash(input.new_password, env.bcryptSaltRounds);
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profil berhasil diperbarui.',
      data: {
        user: serializeUser(user),
      },
    });
  } catch (err) {
    next(err);
  }
}
