import mongoose, { type InferSchemaType, type Model } from "mongoose";

const { Schema, model, models } = mongoose;
const doctorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    specialization: { type: String, required: true, trim: true },
    specializationNormalized: { type: String, required: true, lowercase: true, trim: true },
    hospital: { type: String, required: true, trim: true },
    hospitalNormalized: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    phoneSearch: { type: String, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
  },
  { timestamps: true },
);

doctorSchema.index({ name: 1, createdAt: -1 });
doctorSchema.index({ specializationNormalized: 1, createdAt: -1 });
doctorSchema.index({ hospitalNormalized: 1, createdAt: -1 });
doctorSchema.index({ email: 1 }, { unique: true });

export type DoctorRecord = InferSchemaType<typeof doctorSchema>;
export const DoctorModel =
  (models.Doctor as Model<DoctorRecord> | undefined) ?? model<DoctorRecord>("Doctor", doctorSchema);
