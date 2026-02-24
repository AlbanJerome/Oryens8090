#!/bin/bash

# =============================================================================
# WO-GL-003: CreateJournalEntryCommand Handler Generator Script
# Complete implementation with Command, Handler, and Idempotency logic
# =============================================================================

set -e  # Exit on any error

echo "🚀 Deploying WO-GL-003: CreateJournalEntryCommand Handler Implementation"
echo "======================================================================="

# Create directory structure
echo "📁 Creating application layer structure..."
mkdir -p packages/core/src/application/commands
mkdir -p packages/core/src/application/handlers
mkdir -p packages/core/src/application/services
mkdir -p packages/core/src/application/repositories
mkdir -p packages/core/src/application/errors

# =============================================================================
# File 1: CreateJournalEntryCommand.ts
# =============================================================================

echo "📝 Creating CreateJournalEntryCommand..."
cat > packages/core/src/application/commands/create-journal-entry.command.ts << 'EOF'
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
EOF

# =============================================================================
# Domain Errors
# =============================================================================

echo "❌ Creating domain errors..."
cat > packages/core/src/application/errors/journal-entry.errors.ts << 'EOF'
export class JournalEntryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'JournalEntryError';
  }
}

export class UnbalancedEntryError extends JournalEntryError {
  constructor(message: string) {
    super(message, 'UNBALANCED_ENTRY');
  }
}

export class AccountNotFoundError extends JournalEntryError {
  constructor(accountCode: string, tenantId: string) {
    super(
      `Account '${accountCode}' not found for tenant '${tenantId}'`,
      'ACCOUNT_NOT_FOUND',
      { accountCode, tenantId }
    );
  }
}

export class PeriodClosedError extends JournalEntryError {
  constructor(periodName: string, status: string) {
    super(
      `Cannot post to ${status.toLowerCase()} period '${periodName}'`,
      'PERIOD_CLOSED',
      { periodName, status }
    );
  }
}

export class DuplicateEntryError extends JournalEntryError {
  constructor(idempotencyKey: string, existingEntryId: string) {
    super(
      `Duplicate journal entry with idempotency key '${idempotencyKey}'`,
      'DUPLICATE_ENTRY',
      { idempotencyKey, existingEntryId }
    );
  }
}
EOF

# =============================================================================
# Repository Interfaces
# =============================================================================

echo "🔌 Creating repository interfaces..."
cat > packages/core/src/application/repositories/interfaces.ts << 'EOF'
import { JournalEntry, Account } from '../../domain/index.js';

export interface IJournalEntryRepository {
  save(entry: JournalEntry): Promise<void>;
  findById(id: string): Promise<JournalEntry | null>;
  findByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<JournalEntry | null>;
}

export interface IAccountRepository {
  findByCode(tenantId: string, accountCode: string): Promise<Account | null>;
  findByCodes(tenantId: string, accountCodes: string[]): Promise<Account[]>;
}

export interface AccountingPeriod {
  id: string;
  tenantId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: 'OPEN' | 'SOFT_CLOSED' | 'HARD_CLOSED';
}

export interface IPeriodRepository {
  canPostToDate(tenantId: string, date: Date): Promise<{
    allowed: boolean;
    period: AccountingPeriod | null;
    reason?: string;
  }>;
}

export interface DomainEvent {
  eventId: string;
  tenantId: string;
  occurredAt: Date;
  eventType: string;
  payload: Record<string, any>;
}

export interface IDomainEventBus {
  publish(event: DomainEvent): Promise<void>;
}
EOF

# =============================================================================
# Idempotency Service
# =============================================================================

echo "🔄 Creating idempotency service..."
cat > packages/core/src/application/services/idempotency.service.ts << 'EOF'
export interface IdempotencyRecord {
  id: string;
  tenantId: string;
  idempotencyKey: string;
  commandType: string;
  result: Record<string, any>;
  executedAt: Date;
  expiresAt: Date;
}

export interface IIdempotencyRepository {
  findByKey(tenantId: string, idempotencyKey: string): Promise<IdempotencyRecord | null>;
  save(record: IdempotencyRecord): Promise<void>;
}

export class IdempotencyService {
  constructor(private repository: IIdempotencyRepository) {}

  async findExisting(tenantId: string, idempotencyKey: string): Promise<IdempotencyRecord | null> {
    return this.repository.findByKey(tenantId, idempotencyKey);
  }

  async recordExecution(
    tenantId: string,
    idempotencyKey: string,
    commandType: string,
    result: any
  ): Promise<void> {
    const record: IdempotencyRecord = {
      id: crypto.randomUUID(),
      tenantId,
      idempotencyKey,
      commandType,
      result,
      executedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
    await this.repository.save(record);
  }
}
EOF

# =============================================================================
# CreateJournalEntryCommandHandler (MAIN HANDLER)
# =============================================================================

echo "⚙️  Creating CreateJournalEntryCommandHandler..."
cat > packages/core/src/application/handlers/create-journal-entry.handler.ts << 'EOF'
import {
  Money,
  JournalEntry,
  JournalEntryLine,
  TemporalBalanceService,
  UnbalancedEntryError as DomainUnbalancedEntryError
} from '../../domain/index.js';

import {
  CreateJournalEntryCommand,
  CreateJournalEntryCommandValidator
} from '../commands/create-journal-entry.command.js';

import {
  JournalEntryError,
  UnbalancedEntryError,
  AccountNotFoundError,
  PeriodClosedError
} from '../errors/journal-entry.errors.js';

import {
  IJournalEntryRepository,
  IAccountRepository,
  IPeriodRepository,
  IDomainEventBus,
  DomainEvent
} from '../repositories/interfaces.js';

import { IdempotencyService } from '../services/idempotency.service.js';

export interface CreateJournalEntryResult {
  journalEntryId: string;
  isSuccess: boolean;
  wasIdempotent: boolean;
  affectedAccounts: string[];
  totalAmountCents: number;
}

export class CreateJournalEntryCommandHandler {
  constructor(
    private journalEntryRepository: IJournalEntryRepository,
    private accountRepository: IAccountRepository,
    private periodRepository: IPeriodRepository,
    private temporalBalanceService: TemporalBalanceService,
    private eventBus: IDomainEventBus,
    private idempotencyService: IdempotencyService
  ) {}

  async handle(command: CreateJournalEntryCommand): Promise<CreateJournalEntryResult> {
    try {
      // 1. Validate command
      this.validateCommand(command);

      // 2. Check idempotency
      if (command.idempotencyKey) {
        const existing = await this.checkIdempotency(command);
        if (existing) return existing;
      }

      // 3. Validate business rules
      await this.validateBusinessRules(command);

      // 4. Create journal entry
      const journalEntry = await this.createJournalEntry(command);

      // 5. Save to database
      await this.journalEntryRepository.save(journalEntry);

      // 6. Update account balances
      await this.temporalBalanceService.applyJournalEntry(
        command.tenantId,
        command.entityId,
        journalEntry
      );

      // 7. Publish events
      await this.publishEvents(journalEntry);

      // 8. Prepare result
      const result: CreateJournalEntryResult = {
        journalEntryId: journalEntry.id,
        isSuccess: true,
        wasIdempotent: false,
        affectedAccounts: journalEntry.getAffectedAccountCodes(),
        totalAmountCents: journalEntry.getTotalDebits().toCents()
      };

      // 9. Record idempotency
      if (command.idempotencyKey) {
        await this.idempotencyService.recordExecution(
          command.tenantId,
          command.idempotencyKey,
          'CreateJournalEntry',
          result
        );
      }

      return result;

    } catch (error) {
      if (error instanceof DomainUnbalancedEntryError) {
        throw new UnbalancedEntryError(error.message);
      }
      if (error instanceof JournalEntryError) {
        throw error;
      }
      throw new JournalEntryError(
        `Failed to create journal entry: ${error.message}`,
        'UNEXPECTED_ERROR'
      );
    }
  }

  private validateCommand(command: CreateJournalEntryCommand): void {
    const validation = CreateJournalEntryCommandValidator.validate(command);
    if (!validation.isValid) {
      throw new JournalEntryError(
        `Command validation failed: ${validation.errors.join(', ')}`,
        'COMMAND_VALIDATION_FAILED',
        { errors: validation.errors }
      );
    }
  }

  private async checkIdempotency(command: CreateJournalEntryCommand): Promise<CreateJournalEntryResult | null> {
    const existing = await this.idempotencyService.findExisting(
      command.tenantId,
      command.idempotencyKey!
    );
    if (existing) {
      return { ...existing.result, wasIdempotent: true } as CreateJournalEntryResult;
    }
    return null;
  }

  private async validateBusinessRules(command: CreateJournalEntryCommand): Promise<void> {
    // Validate accounts exist
    const accountCodes = [...new Set(command.lines.map(line => line.accountCode))];
    const accounts = await this.accountRepository.findByCodes(command.tenantId, accountCodes);
    const foundCodes = new Set(accounts.map(account => account.code));
    const missingCodes = accountCodes.filter(code => !foundCodes.has(code));
    if (missingCodes.length > 0) {
      throw new AccountNotFoundError(missingCodes[0], command.tenantId);
    }

    // Validate period
    const periodCheck = await this.periodRepository.canPostToDate(command.tenantId, command.postingDate);
    if (!periodCheck.allowed) {
      if (periodCheck.period) {
        throw new PeriodClosedError(periodCheck.period.name, periodCheck.period.status);
      }
      throw new JournalEntryError('No accounting period found for posting date', 'NO_PERIOD_FOUND');
    }
  }

  private async createJournalEntry(command: CreateJournalEntryCommand): Promise<JournalEntry> {
    const lines = command.lines.map(cmdLine => new JournalEntryLine({
      entryId: '',
      accountCode: cmdLine.accountCode,
      debitAmount: Money.fromCents(cmdLine.debitAmountCents, command.currency),
      creditAmount: Money.fromCents(cmdLine.creditAmountCents, command.currency),
      costCenter: cmdLine.costCenter,
      description: cmdLine.description
    }));

    return JournalEntry.create({
      tenantId: command.tenantId,
      entityId: command.entityId,
      postingDate: command.postingDate,
      sourceModule: command.sourceModule,
      sourceDocumentId: command.sourceDocumentId,
      sourceDocumentType: command.sourceDocumentType,
      description: command.description,
      lines,
      isIntercompany: command.isIntercompany || false,
      counterpartyEntityId: command.counterpartyEntityId,
      createdBy: command.createdBy
    });
  }

  private async publishEvents(journalEntry: JournalEntry): Promise<void> {
    const event: DomainEvent = {
      eventId: crypto.randomUUID(),
      tenantId: journalEntry.tenantId,
      occurredAt: new Date(),
      eventType: 'JournalEntryPosted',
      payload: {
        journalEntryId: journalEntry.id,
        entityId: journalEntry.entityId,
        postingDate: journalEntry.postingDate.toISOString(),
        totalAmountCents: journalEntry.getTotalDebits().toCents(),
        affectedAccounts: journalEntry.getAffectedAccountCodes(),
        sourceModule: journalEntry.sourceModule
      }
    };
    await this.eventBus.publish(event);
  }
}
EOF

# =============================================================================
# Application Layer Index
# =============================================================================

echo "📦 Creating application layer exports..."
cat > packages/core/src/application/index.ts << 'EOF'
// Commands
export {
  CreateJournalEntryCommand,
  CreateJournalEntryLineCommand,
  CreateJournalEntryCommandValidator
} from './commands/create-journal-entry.command.js';

// Handlers
export {
  CreateJournalEntryCommandHandler,
  CreateJournalEntryResult
} from './handlers/create-journal-entry.handler.js';

// Services
export {
  IdempotencyService,
  IdempotencyRecord,
  IIdempotencyRepository
} from './services/idempotency.service.js';

// Interfaces
export {
  IJournalEntryRepository,
  IAccountRepository,
  IPeriodRepository,
  AccountingPeriod,
  IDomainEventBus,
  DomainEvent
} from './repositories/interfaces.js';

// Errors
export {
  JournalEntryError,
  UnbalancedEntryError,
  AccountNotFoundError,
  PeriodClosedError,
  DuplicateEntryError
} from './errors/journal-entry.errors.js';
EOF

# =============================================================================
# Update Main Index
# =============================================================================

echo "📦 Updating main core index..."
cat > packages/core/src/index.ts << 'EOF'
// Domain Layer (WO-GL-002)
export * from './domain/index.js';

// Application Layer (WO-GL-003)
export * from './application/index.js';

// Key exports for convenience
export {
  Money,
  JournalEntry,
  Account,
  TemporalBalanceService
} from './domain/index.js';

export {
  CreateJournalEntryCommand,
  CreateJournalEntryCommandHandler,
  IdempotencyService
} from './application/index.js';
EOF

# =============================================================================
# Complete!
# =============================================================================

echo ""
echo "✅ WO-GL-003 Implementation Complete!"
echo ""
echo "📂 Generated files:"
echo "   📝 CreateJournalEntryCommand with validation"
echo "   ⚙️  CreateJournalEntryCommandHandler (main entry point)"
echo "   🔄 IdempotencyService for duplicate prevention"
echo "   🔌 Repository interfaces (Hexagonal Architecture)"
echo "   ❌ Domain-specific error types"
echo ""

read -p "🔄 Commit changes to git? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add packages/core/src/application/ packages/core/src/index.ts
    git commit -m "feat(GL): Complete WO-GL-003 - CreateJournalEntryCommand Handler

- Implement CreateJournalEntryCommand with validation
- Add CommandHandler as single entry point for GL posting  
- Include IdempotencyService for duplicate prevention
- Add repository interfaces (Hexagonal Architecture)
- Implement domain-specific error handling
- Full validation pipeline and event publishing

Resolves: WO-GL-003"
    git push origin main
    echo "✅ WO-GL-003 deployed successfully!"
else
    echo "⏭️  Files ready - commit manually when ready"
fi

