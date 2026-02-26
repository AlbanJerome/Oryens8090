'use client';

import { useId } from 'react';

/**
 * Renders JSONB / custom metadata as dynamic key-value pairs.
 * Use in Invoices, Journal Entries, and any form that stores metadata in the database.
 */

export type MetadataFieldItem = { key: string; value: string };

export type MetadataFieldProps = {
  /** Current key-value list (e.g. from entry metadata). */
  value: MetadataFieldItem[];
  /** Called when user adds, edits, or removes a field. */
  onChange: (value: MetadataFieldItem[]) => void;
  /** Optional suggested keys (e.g. Department, Project, ReferenceID) for hints or defaults. */
  suggestedKeys?: string[];
  /** Label above the field set. */
  label?: string;
  /** Help text below the label. */
  helpText?: string;
  /** Disable all inputs. */
  disabled?: boolean;
  /** Extra class for the wrapper. */
  className?: string;
};

export function MetadataField({
  value,
  onChange,
  suggestedKeys = [],
  label = 'Custom Fields',
  helpText = 'Optional key-value pairs stored in metadata (e.g. Department, Project, ReferenceID).',
  disabled = false,
  className = '',
}: MetadataFieldProps) {
  const listId = useId();
  const addField = () => onChange([...value, { key: '', value: '' }]);
  const removeAt = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const updateAt = (idx: number, patch: Partial<MetadataFieldItem>) =>
    onChange(
      value.map((f, i) => (i === idx ? { ...f, ...patch } : f))
    );

  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50/50 p-3 ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <button
          type="button"
          onClick={addField}
          disabled={disabled}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
        >
          + Add field
        </button>
      </div>
      {helpText && <p className="mb-2 text-xs text-slate-500">{helpText}</p>}
      <div className="space-y-2">
        {value.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              type="text"
              value={item.key}
              onChange={(e) => updateAt(idx, { key: e.target.value })}
              placeholder="Key"
              list={suggestedKeys.length ? listId : undefined}
              disabled={disabled}
              className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 disabled:bg-slate-100"
            />
            <input
              type="text"
              value={item.value}
              onChange={(e) => updateAt(idx, { value: e.target.value })}
              placeholder="Value"
              disabled={disabled}
              className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 disabled:bg-slate-100"
            />
            <button
              type="button"
              onClick={() => removeAt(idx)}
              disabled={disabled}
              className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-50"
              aria-label="Remove field"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      {suggestedKeys.length > 0 && (
        <datalist id={listId}>
          {suggestedKeys.map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>
      )}
    </div>
  );
}
