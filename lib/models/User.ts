import mongoose, { Schema, Document, Model } from "mongoose";
import type { UserRole } from "@/lib/types";



export type { UserRole };

export interface IUser extends Document {
  employeeId: string;
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: UserRole;
  department: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    employeeId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: {
      type: String,
      required: true,
      select: false, // never send this back in a query result by default
    },
    role: {
      type: String,
      enum: ["super_admin", "department_head", "staff", "hr_admin"],
      required: true,
    },
    department: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Mongoose re-uses the model if it's already compiled — stops Next.js's
// hot-reload from throwing "model already exists" errors.
interface IUserModel extends Model<IUser> {
  generateEmployeeId(): Promise<string>;
}

UserSchema.statics.generateEmployeeId = async function (): Promise<string> {
  // Random, not sequential — and checked against the database directly
  // rather than derived from a count, so one failed insert can never cause
  // the next one to collide too.
  let id: string;
  let exists = true;
  do {
    const random = Math.floor(1000 + Math.random() * 9000); // 1000–9999
    id = `HG-${random}`;
    exists = !!(await this.findOne({ employeeId: id }));
  } while (exists);
  return id;
};

const User = (mongoose.models.User as IUserModel) || mongoose.model<IUser, IUserModel>("User", UserSchema);

export default User;