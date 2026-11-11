import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, ValidateNested } from 'class-validator';
import {
    DASHBOARD_BLOCK_IDS,
    DASHBOARD_WIDTHS,
} from '../dashboard-layout.constants';
import type {
    DashboardBlockId,
    DashboardWidth,
} from '../dashboard-layout.constants';

export class DashboardLayoutItemDto {
    @IsIn([...DASHBOARD_BLOCK_IDS])
    id: DashboardBlockId;

    @IsIn([...DASHBOARD_WIDTHS])
    width: DashboardWidth;
}

export class UpdateDashboardLayoutDto {
    @IsArray()
    @ArrayMaxSize(20)
    @ValidateNested({ each: true })
    @Type(() => DashboardLayoutItemDto)
    items: DashboardLayoutItemDto[];
}
