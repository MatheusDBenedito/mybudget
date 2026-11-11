import { Controller, Get, Post, Body, Patch, Param, Query, Delete } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto';

@Controller('transactions')
export class TransactionsController {
    constructor(private readonly transactionsService: TransactionsService) { }

    @Post()
    create(@Body() createTransactionDto: CreateTransactionDto) {
        return this.transactionsService.create(createTransactionDto);
    }

    @Get()
    findAll(
        @Query('month') month?: string,
        @Query('year') year?: string,
    ) {
        const parsedMonth = month ? parseInt(month, 10) : undefined;
        const parsedYear = year ? parseInt(year, 10) : undefined;
        return this.transactionsService.findAll(parsedMonth, parsedYear);
    }

    @Patch(':id/status')
    updateStatus(
        @Param('id') id: string,
        @Body() updateTransactionStatusDto: UpdateTransactionStatusDto,
    ) {
        return this.transactionsService.updateStatus(id, updateTransactionStatusDto);
    }

    /** scope=series removes a fixed lançamento from this month on; default removes only this month. */
    @Delete(':id')
    remove(@Param('id') id: string, @Query('scope') scope?: string) {
        return this.transactionsService.remove(id, scope === 'series' ? 'series' : 'single');
    }
}
