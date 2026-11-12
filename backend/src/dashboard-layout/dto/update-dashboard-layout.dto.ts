import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import {
    DASHBOARD_BLOCK_IDS,
    MAX_DASHBOARD_HEIGHT_PX,
    MAX_DASHBOARD_WIDTH_PCT,
    MIN_DASHBOARD_HEIGHT_PX,
} from '../dashboard-layout.constants';
import type { DashboardBlockId } from '../dashboard-layout.constants';

export class DashboardLayoutItemDto {
    @IsIn([...DASHBOARD_BLOCK_IDS])
    id: DashboardBlockId;

    // Accepts percentage widths (20..100) and legacy 12-col widths (3..12)
    @IsInt()
    @Min(3)
    @Max(MAX_DASHBOARD_WIDTH_PCT)
    width: number;

    @IsOptional()
    @IsInt()
    @Min(MIN_DASHBOARD_HEIGHT_PX)
    @Max(MAX_DASHBOARD_HEIGHT_PX)
    height?: number;
}

export class UpdateDashboardLayoutDto {
    @IsArray()
    @ArrayMaxSize(20)
    @ValidateNested({ each: true })
    @Type(() => DashboardLayoutItemDto)
    items: DashboardLayoutItemDto[];
}
