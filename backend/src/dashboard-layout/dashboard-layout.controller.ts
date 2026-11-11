import { Body, Controller, Get, Put } from '@nestjs/common';
import { DashboardLayoutService } from './dashboard-layout.service';
import { UpdateDashboardLayoutDto } from './dto/update-dashboard-layout.dto';

@Controller('dashboard-layout')
export class DashboardLayoutController {
    constructor(private readonly dashboardLayoutService: DashboardLayoutService) { }

    @Get()
    get() {
        return this.dashboardLayoutService.get();
    }

    @Put()
    save(@Body() updateDashboardLayoutDto: UpdateDashboardLayoutDto) {
        return this.dashboardLayoutService.save(updateDashboardLayoutDto.items);
    }
}
