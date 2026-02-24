/**
 * WO-GL-008: General Ledger API Endpoints
 * API layer: DTOs and controllers
 */

export {
  toAccountDto,
  type AccountDto,
  type AccountBalanceDto
} from './dto/AccountDto.js';

export {
  type GetConsolidatedBalanceSheetQuery,
  type ConsolidatedBalanceSheetLineDto,
  type ConsolidatedBalanceSheetResultDto
} from './dto/consolidation.dto.js';

export { AccountController } from './controllers/AccountController.js';

export {
  TrialBalanceController,
  type TrialBalanceQuery,
  type TrialBalanceReportDto
} from './controllers/TrialBalanceController.js';
