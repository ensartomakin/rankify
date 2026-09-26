/**
 * Which product field of the connected store feeds each generic product
 * attribute. Values are adapter-specific source ids (e.g. "extra:6" for
 * T-Soft's "Ek Bilgi 6"); the UI only ever shows the labels the adapter
 * provides for them.
 */
export interface FieldMapping {
  season?: string;
}

export interface FieldOption {
  id:    string;
  label: string;
}
