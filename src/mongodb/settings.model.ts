import mongoose, { Schema, Document } from 'mongoose';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';

// interface for each article
interface ISettings {
  name: string;
  setting: Record<string, unknown>;
}

// create the schema for each field
const SettingsSchemaFields: Record<keyof ISettings, unknown> = {
  name: { type: String },
  setting: { type: {} },
};

// mongoose schema for each article
const SettingsSchema = new Schema(SettingsSchemaFields);

// add pagination to aggregation
SettingsSchema.plugin(aggregatePaginate);

// create the model based on the schema
interface ISettingsDoc extends ISettings, Document {} // combine the 2 interfaces
mongoose.model<ISettingsDoc>('Settings', SettingsSchema);

export { ISettings, ISettingsDoc };
