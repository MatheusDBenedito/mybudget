import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
} from '@nestjs/common';
import { InvestmentsService } from './investments.service';
import { CreateInvestmentDto } from './dto/create-investment.dto';
import { UpdateInvestmentDto } from './dto/update-investment.dto';

@Controller('investments')
export class InvestmentsController {
    constructor(private readonly investmentsService: InvestmentsService) { }

    @Post()
    create(@Body() createInvestmentDto: CreateInvestmentDto) {
        return this.investmentsService.create(createInvestmentDto);
    }

    @Get()
    findAll() {
        return this.investmentsService.findAll();
    }

    @Get('dividends')
    findAllDividends() {
        return this.investmentsService.findAllDividends();
    }

    @Get('projections')
    getProjections(
        @Query('month') month?: string,
        @Query('year') year?: string,
        @Query('months') months?: string,
    ) {
        const m = month ? parseInt(month, 10) : undefined;
        const y = year ? parseInt(year, 10) : undefined;
        const count = months ? Math.min(Math.max(parseInt(months, 10) || 12, 1), 24) : 12;
        return this.investmentsService.getProjections(m, y, count);
    }

    @Post('dividends/sync')
    syncAllDividends() {
        return this.investmentsService.syncAllDividends(true);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.investmentsService.findOne(id);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() updateInvestmentDto: UpdateInvestmentDto,
    ) {
        return this.investmentsService.update(id, updateInvestmentDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.investmentsService.remove(id);
    }
}
