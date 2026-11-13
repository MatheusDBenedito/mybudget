import { Controller, Post, Body } from '@nestjs/common';
import {
    CurrentWorkspace,
    RequirePermissions,
    RequireSuperAdmin,
    type WorkspaceRequestContext,
} from '../auth/decorators/permissions.decorator';
import { RecurringExpensesService } from './recurring-expenses.service';
import { CreateRecurringExpenseDto } from './dto/create-recurring-expense.dto';

@Controller('recurring-expenses')
export class RecurringExpensesController {
    constructor(private readonly recurringExpensesService: RecurringExpensesService) {}

    @Post()
    @RequirePermissions('create:despesa')
    create(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Body() createRecurringExpenseDto: CreateRecurringExpenseDto,
    ) {
        return this.recurringExpensesService.create(ctx.workspaceId, createRecurringExpenseDto);
    }

    @Post('process-monthly')
    @RequireSuperAdmin()
    processMonthly() {
        return this.recurringExpensesService.processMonthlyRecurrences();
    }
}
