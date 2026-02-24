/**
 * WO-GL-003: CreateJournalEntryCommand
 * Command object for posting journal entries with validation
 */

import { Currency } from '../../domain/index.js';

export interface CreateJournalEntryLineCommand {
  accountCode: string;
  debitAmountCents: number;
  creditAmountCents: number;
  costCenter?: string;
  projectId?: string;
  intercompanyPartnerId?: string;
  eliminationAccountCode?: string;
  description?: string;
}

export interface CreateJournalEntryCommand {
  // Identity
  tenantId: string;
  entityId: string;
  
  // Business data
  postingDate: Date;
  sourceModule: string;
  sourceDocumentId: string;
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
}

export class CreateJournalEntryCommandValidator {
  static validate(command: CreateJournalEnt
froze again - lets do this once more 

Proceed with Option 3 (Shell Script) for WO-GL-003. Ensure it includes the CreateJournalEntryCommand, the CommandHandler, and the idempotency logic we discussed. I am ready to deploy it via the terminal.

Thought for 2s
You're right! Let me create a complete, focused shell script for WO-GL-003 without freezing:
#!/bin/bash

# =============================================================================
# WO-GL-003: CreateJournalEntryCommand Handler - Complete Implementation
# =============================================================================

set -e
echo "🚀 Deploying WO-GL-003: CreateJournalEntryCommand Handler"
echo "======================================================"

# Create directories
mkdir -p packages/core/src/application/{commands,handlers,services,repositories,errors}

# =============================================================================
# CreateJournalEntryCommand
# =============================================================================

echo "📝 Creating CreateJournalEntryCommand..."
cat > packages/core/src/application/commands/create-journal-entry.command.ts << 'EOF'
import { Currency } from '../../domain/index.js';

export interface CreateJournalEntryLineCommand {
  accountCode: string;
  debitAmountCents: number;
  creditAmountCents: number;
  costCenter?: string;
  description?: string;
}

export interface CreateJournalEntryCommand {
  tenantId: string;
  entityId: string;
  postingDate: Date;
  sourceModule: string;
  sourceDocumentId: string;
  sourceDocumentType: string;
  description: string;
  currency: Currency;
  lines: CreateJournalEntryLineCommand[];
  isIntercompany?: boolean;
  counterpartyEntityId?: string;
  idempotencyKey?: string;
  createdBy?: string;
}

export class CreateJournalEntryCommandValidator {
  static validate(command: CreateJournalEntryCommand): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!command.tenantId?.trim()) errors.push('tenantId is required');
    if (!command.entityId?.trim()) errors.push('entityId is required');
    if (!command.postingDate) errors.push('postingDate is required');
    if (!command.sourceModule?.trim()) errors.push('sourceModule is required');
    if (!command.sourceDocumentId?.trim()) errors.push('sourceDocumentId is required');
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

    // Balance validation
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

    return { isValid: errors.length === 0, errors };
  }
}
