/**
 * WO-GL-008: General Ledger API Endpoints
 * API layer: DTOs and controllers
 */

export {
  toAccountDto,
  type AccountDto,
  type AccountBalanceDto
} from './dto/AccountDto';

export {
  type GetConsolidatedBalanceSheetQuery,
  type ConsolidatedBalanceSheetLineDto,
  type ConsolidatedBalanceSheetResultDto
} from './dto/consolidation.dto';

export { AccountController } from './controllers/AccountController';

export {
  TrialBalanceController,
  type TrialBalanceQuery,
  type TrialBalanceReportDto
} from './controllers/TrialBalanceController';

export {
  FinancialReportController,
  type ProfitAndLossQuery,
  type BalanceSheetQuery
} from './controllers/FinancialReportController';

export {
  type ProfitAndLossReportDto,
  type BalanceSheetReportDto,
  type ProfitAndLossLineDto,
  type BalanceSheetLineDto,
  type BalanceSheetSection
} from './dto/FinancialReportDto';
