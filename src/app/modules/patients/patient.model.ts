import mongoose, { type InferSchemaType, type Model } from "mongoose";
import {
  patientConditionSchema,
  patientStatusSchema,
  genderSchema,
} from "@doctor-tracker/contracts";

const { Schema, model, models } = mongoose;
const patientSchema = new Schema(
  {
    doctorId: { type: Schema.Types.ObjectId, required: true, ref: "Doctor" },
    name: { type: String, required: true, trim: true },
    nameSearch: { type: String, required: true, lowercase: true, trim: true },
    age: { type: Number, required: true, min: 0, max: 120 },
    gender: { type: String, enum: genderSchema.options, required: true },
    phone: { type: String, required: true, trim: true },
    phoneSearch: { type: String, required: true, index: true },
    email: { type: String, lowercase: true, trim: true },
    condition: { type: String, enum: patientConditionSchema.options, required: true },
    status: { type: String, enum: patientStatusSchema.options, required: true, default: "Active" },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

patientSchema.index({ createdAt: -1, _id: -1 });
patientSchema.index({ condition: 1, createdAt: -1, _id: -1 });
patientSchema.index({ status: 1, createdAt: -1, _id: -1 });
patientSchema.index({ doctorId: 1, createdAt: -1, _id: -1 });
patientSchema.index({ doctorId: 1, condition: 1, createdAt: -1, _id: -1 });
patientSchema.index({ nameSearch: 1 });
patientSchema.index({ email: 1 });

export type PatientRecord = InferSchemaType<typeof patientSchema>;
export const PatientModel =
  (models.Patient as Model<PatientRecord> | undefined) ??
  model<PatientRecord>("Patient", patientSchema);
