import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    @Get('expenses-by-category')
    async getExpensesByCategory(
        @Query('month') monthString: string,
        @Query('year') yearString: string,
    ) {
        const month = parseInt(monthString, 10);
        const year = parseInt(yearString, 10);

        if (isNaN(month) || isNaN(year)) {
            throw new BadRequestException('Month and year queries are required and must be numbers.');
        }

        return this.reportsService.getExpensesByCategory(month, year);
    }

    @Get('monthly-evolution')
    async getMonthlyEvolution() {
        return this.reportsService.getMonthlyEvolution();
    }
}
