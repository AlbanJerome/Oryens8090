/**
 * WO-GL-003: CreateJournalEntryCommand
 * Command object for posting journal entries with validation
 */

import { Currency } from '../../domain/index';
import { validateMetadata } from '../validation/metadata-validator';

/** Metadata: optional key-value pairs (e.g. Department, Project, ReferenceID). Values must be string, number, or boolean. */
export type JournalEntryMetadata = Record<string, string | number | boolean>;

export interface CreateJournalEntryLineCommand {
  accountCode: string;
  debitAmountCents: number;
  creditAmountCents: number;
  costCenter?: string;
  projectId?: string;
  intercompanyPartnerId?: string;
  eliminationAccountCode?: string;
  description?: string;
  metadata?: JournalEntryMetadata;
  /** Triple-Entry: amount in original currency (smallest unit). */
  transactionAmountCents?: number;
  /** Triple-Entry: original currency code (e.g. JPY). */
  transactionCurrencyCode?: string;
  /** Triple-Entry: rate at posting (1 transaction unit = exchangeRate reporting units). */
  exchangeRate?: number;
}

export interface CreateJournalEntryCommand {
  // Identity
  tenantId: string;
  entityId: string;
  
  // Business data
  postingDate: Date;
  sourceModule: string;
  /** Optional; when omitted, handler may use a generated UUID. */
  sourceDocumentId?: string;
  sourceDocumentType: string;
  description: string;
  currency: Currency;
  
  // Entry lines
  lines: CreateJournalEntryLineCommand[];
  
  // Intercompany
  isIntercompany?: boolean;
  counterpartyEntityId?: string;
  
  // Control
  idempotencyKey?: string;
  validTimeStart?: Date;
  createdBy?: string;
  /** WO-GL-009: Permissions for override checks (e.g. accounting:post_to_closed_period). */
  permissions?: string[];
  /** Global Scale: optional metadata (validated against JSON Schema). */
  metadata?: JournalEntryMetadata;
}

export class CreateJournalEntryCommandValidator {
  static validate(command: CreateJournalEntryCommand): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!command.tenantId?.trim()) errors.push('tenantId is required');
    if (!command.entityId?.trim()) errors.push('entityId is required');
    if (!command.postingDate) errors.push('postingDate is required');
    if (!command.sourceModule?.trim()) errors.push('sourceModule is required');
    if (!command.description?.trim()) errors.push('description is required');
    if (!command.currency) errors.push('currency is required');

    if (!command.lines || command.lines.length < 2) {
      errors.push('At least 2 journal entry lines are required');
    }

    command.lines?.forEach((line, index) => {
      if (!line.accountCode?.trim()) {
        errors.push(`Line ${index + 1}: accountCode is required`);
      }
      const hasDebit = line.debitAmountCents > 0;
      const hasCredit = line.creditAmountCents > 0;
      if (!hasDebit && !hasCredit) {
        errors.push(`Line ${index + 1}: must have either debit or credit amount`);
      }
      if (hasDebit && hasCredit) {
        errors.push(`Line ${index + 1}: cannot have both debit and credit amounts`);
      }
    });

    if (command.lines && command.lines.length > 0) {
      const totalDebits = command.lines.reduce((sum, line) => sum + line.debitAmountCents, 0);
      const totalCredits = command.lines.reduce((sum, line) => sum + line.creditAmountCents, 0);
      if (totalDebits !== totalCredits) {
        errors.push(`Entry is unbalanced: debits=${totalDebits}, credits=${totalCredits}`);
      }
    }

    if (command.isIntercompany && !command.counterpartyEntityId?.trim()) {
      errors.push('counterpartyEntityId is required for intercompany entries');
    }

    if (command.metadata !== undefined && command.metadata !== null) {
      const meta = validateMetadata(command.metadata);
      if (!meta.valid && meta.errors?.length) {
        errors.push(`metadata: ${meta.errors.join('; ')}`);
      }
    }
    command.lines?.forEach((line, index) => {
      if (line.metadata !== undefined && line.metadata !== null) {
        const meta = validateMetadata(line.metadata);
        if (!meta.valid && meta.errors?.length) {
          errors.push(`line ${index + 1} metadata: ${meta.errors.join('; ')}`);
        }
      }
    });

    return { isValid: errors.length === 0, errors };
  }
}
