import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const sessionSchema = new Schema({
  tokenDigest: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  createdAt: { type: Date, default: Date.now, required: true },
});

type SessionRecord = InferSchemaType<typeof sessionSchema>;
export const SessionModel = (models.Session as Model<SessionRecord> | undefined) ?? model<SessionRecord>("Session", sessionSchema);
