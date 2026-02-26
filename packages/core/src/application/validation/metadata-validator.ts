/**
 * Global Scale: JSON Schema validation for journal entry metadata.
 * Allows standard fields (Department, Project, ReferenceID) and custom string key-value pairs.
 */

import Ajv from 'ajv';

const METADATA_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  properties: {
    Department: { type: 'string', maxLength: 255 },
    Project: { type: 'string', maxLength: 255 },
    ReferenceID: { type: 'string', maxLength: 255 },
  },
};

const ajv = new Ajv({ allErrors: true });
const validateSchema = ajv.compile(METADATA_SCHEMA);

export interface MetadataValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Validates metadata for journal entries/lines.
 * Accepts null/undefined (optional metadata) or an object with optional Department, Project, ReferenceID and custom string keys.
 */
export function validateMetadata(metadata: unknown): MetadataValidationResult {
  if (metadata === null || metadata === undefined) {
    return { valid: true };
  }
  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { valid: false, errors: ['Metadata must be an object'] };
  }
  const obj = metadata as Record<string, unknown>;
  for (const value of Object.values(obj)) {
    if (value === null || (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')) {
      return { valid: false, errors: ['Metadata values must be string, number, or boolean (null not allowed)'] };
    }
  }
  const valid = validateSchema(obj as any);
  if (valid) return { valid: true };
  const errs = (validateSchema as { errors?: Array<{ instancePath?: string; message?: string; keyword?: string }> }).errors;
  const errors = (errs ?? []).map(
    (e) => `${e.instancePath || 'metadata'} ${e.message ?? e.keyword}`
  );
  return { valid: false, errors };
}
