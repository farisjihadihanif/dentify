import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IClinicDirectory {
  osm_id: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  opening_hours: string | null;
  osm_url: string;
}

export interface IClinicDirectoryDocument extends IClinicDirectory, Document {
  _id: mongoose.Types.ObjectId;
}

const clinicDirectorySchema = new Schema<IClinicDirectoryDocument>(
  {
    osm_id: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true, index: true },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    phone: { type: String, default: null },
    opening_hours: { type: String, default: null },
    osm_url: { type: String, required: true, trim: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'clinic_directory',
  },
);

export const ClinicDirectory: Model<IClinicDirectoryDocument> =
  (mongoose.models.ClinicDirectory as Model<IClinicDirectoryDocument> | undefined) ||
  mongoose.model<IClinicDirectoryDocument>('ClinicDirectory', clinicDirectorySchema);
