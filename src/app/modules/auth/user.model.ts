import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin"], default: "admin", required: true },
    isActive: { type: Boolean, default: true, required: true },
  },
  { timestamps: true }
);

export type UserRecord = InferSchemaType<typeof userSchema>;
export const UserModel = (models.User as Model<UserRecord> | undefined) ?? model<UserRecord>("User", userSchema);
