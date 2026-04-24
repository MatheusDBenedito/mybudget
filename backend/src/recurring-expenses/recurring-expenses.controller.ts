import { Controller, Post, Body } from '@nestjs/common';
import { RecurringExpensesService } from './recurring-expenses.service';
import { CreateRecurringExpenseDto } from './dto/create-recurring-expense.dto';

@Controller('recurring-expenses')
export class RecurringExpensesController {
    constructor(private readonly recurringExpensesService: RecurringExpensesService) { }

    @Post()
    create(@Body() createRecurringExpenseDto: CreateRecurringExpenseDto) {
        return this.recurringExpensesService.create(createRecurringExpenseDto);
    }

    /**
     * Endpoint designed to be triggered by an external Cron Job (e.g., Vercel Cron, GitHub Actions)
     * It is best to secure this endpoint via a secret header in production.
     */
    @Post('process-monthly')
    processMonthly() {
        return this.recurringExpensesService.processMonthlyRecurrences();
    }
}
