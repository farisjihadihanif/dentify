import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { USER_ROLES, type UserRole } from '../constants/domain';

export interface IUser {
  full_name: string;
  email: string;
  username?: string;
  avatar: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface IUserDocument extends IUser, Document {
  _id: mongoose.Types.ObjectId;
}

export interface SerializedUser {
  id: string;
  full_name: string;
  email: string;
  username: string | null;
  avatar: string;
  role: UserRole;
}

const userSchema = new Schema<IUserDocument>(
  {
    full_name: {
      type: String,
      required: [true, 'Nama lengkap wajib diisi.'],
      trim: true,
      minlength: [2, 'Nama lengkap minimal 2 karakter.'],
      maxlength: [100, 'Nama lengkap maksimal 100 karakter.'],
    },
    email: {
      type: String,
      required: [true, 'Email wajib diisi.'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      minlength: [3, 'Username minimal 3 karakter.'],
      maxlength: [30, 'Username maksimal 30 karakter.'],
      match: [/^[a-z0-9._-]+$/, 'Username hanya boleh berisi huruf kecil, angka, titik, garis bawah, atau tanda hubung.'],
    },
    avatar: {
      type: String,
      default: '',
    },
    password_hash: {
      type: String,
      required: [true, 'Password hash wajib diisi.'],
      select: false,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'user',
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    collection: 'users',
    strict: true,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        const id = ret._id ? String(ret._id) : undefined;
        delete ret._id;
        delete ret.__v;
        delete ret.password_hash;
        return {
          id,
          full_name: ret.full_name,
          email: ret.email,
          username: ret.username ?? null,
          avatar: ret.avatar ?? '',
          role: ret.role,
          is_active: ret.is_active,
          created_at: ret.created_at,
          updated_at: ret.updated_at,
        };
      },
    },
  },
);

export function serializeUser(user: IUserDocument): SerializedUser {
  return {
    id: user._id.toString(),
    full_name: user.full_name,
    email: user.email,
    username: user.username ?? null,
    avatar: user.avatar ?? '',
    role: user.role,
  };
}

export const User: Model<IUserDocument> =
  (mongoose.models.User as Model<IUserDocument>) ||
  mongoose.model<IUserDocument>('User', userSchema);
