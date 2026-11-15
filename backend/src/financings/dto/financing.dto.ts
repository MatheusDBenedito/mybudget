import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum AmortizationSystemDto {
  SAC = 'SAC',
  PRICE = 'PRICE',
}

export enum FinancingIndexerDto {
  TR = 'TR',
  IPCA = 'IPCA',
  POUPANCA = 'POUPANCA',
  FIXO = 'FIXO',
}

export enum FinancingInstallmentStatusDto {
  PAID = 'PAID',
  PENDING = 'PENDING',
}

export enum ExtraAmortizationStrategyDto {
  REDUCE_TERM = 'REDUCE_TERM',
  REDUCE_INSTALLMENT = 'REDUCE_INSTALLMENT',
}

export enum ExtraAmortizationSourceDto {
  OWN_FUNDS = 'OWN_FUNDS',
  FGTS = 'FGTS',
}

export class CreateFinancingDto {
  @IsString()
  name!: string;

  @IsString()
  bankName!: string;

  @IsOptional()
  @IsString()
  contractNumber?: string;

  @IsOptional()
  @IsString()
  propertyAddress?: string;

  @IsOptional()
  @IsEnum(AmortizationSystemDto)
  system?: AmortizationSystemDto;

  @IsOptional()
  @IsEnum(FinancingIndexerDto)
  indexer?: FinancingIndexerDto;

  @IsNumber()
  @Min(0)
  propertyValue!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  downPayment?: number;

  @IsNumber()
  @Min(0)
  financedAmount!: number;

  @IsNumber()
  @Min(0)
  currentBalance!: number;

  @IsNumber()
  @Min(0)
  nominalRateAnnual!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  effectiveRateAnnual?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cetAnnual?: number;

  @IsInt()
  @Min(1)
  @Max(600)
  totalMonths!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number;

  @IsDateString()
  contractDate!: string;

  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyAdminFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyInsurance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fgtsBalance?: number;

  @IsOptional()
  @IsDateString()
  lastFgtsUsageDate?: string;

  @IsOptional()
  @IsString()
  linkedFixedDescription?: string | null;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateFinancingDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  contractNumber?: string;

  @IsOptional()
  @IsString()
  propertyAddress?: string;

  @IsOptional()
  @IsEnum(AmortizationSystemDto)
  system?: AmortizationSystemDto;

  @IsOptional()
  @IsEnum(FinancingIndexerDto)
  indexer?: FinancingIndexerDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  propertyValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  downPayment?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  financedAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentBalance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  nominalRateAnnual?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  effectiveRateAnnual?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cetAnnual?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  totalMonths?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number;

  @IsOptional()
  @IsDateString()
  contractDate?: string;

  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyAdminFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyInsurance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fgtsBalance?: number;

  @IsOptional()
  @IsDateString()
  lastFgtsUsageDate?: string | null;

  @IsOptional()
  @IsString()
  linkedFixedDescription?: string | null;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateExtraAmortizationDto {
  @IsDateString()
  date!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsEnum(ExtraAmortizationStrategyDto)
  strategy?: ExtraAmortizationStrategyDto;

  @IsOptional()
  @IsEnum(ExtraAmortizationSourceDto)
  source?: ExtraAmortizationSourceDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  installmentsReduced?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateInstallmentStatusDto {
  @IsEnum(FinancingInstallmentStatusDto)
  status!: FinancingInstallmentStatusDto;

  @IsOptional()
  @IsDateString()
  paidDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paidAmount?: number;
}

export class SimulateFinancingDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  extraAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyExtra?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cdiAnnualRatePct?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  cdiPercentage?: number;

  @IsOptional()
  @IsString()
  investmentType?: 'CDB' | 'LCI_LCA' | 'CUSTOM';

  @IsOptional()
  @IsNumber()
  @Min(0)
  customAnnualRatePct?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(420)
  horizonMonths?: number;

  @IsOptional()
  @IsBoolean()
  includeSchedule?: boolean;
}
