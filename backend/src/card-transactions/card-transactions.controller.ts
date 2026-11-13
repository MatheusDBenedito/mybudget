import { Controller, Post, Body, Get, Param, Query, BadRequestException, Delete, Patch, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
    CurrentWorkspace,
    RequireAnyPermissions,
    RequirePermissions,
    type WorkspaceRequestContext,
} from '../auth/decorators/permissions.decorator';
import { CardTransactionsService } from './card-transactions.service';
import { CreateCardTransactionDto } from './dto/create-card-transaction.dto';
import { UpdateCardTransactionDto } from './dto/update-card-transaction.dto';
import { PdfParserService, ParsedTransaction } from './pdf-parser.service';
import { PrismaService } from '../prisma/prisma.service';
import { calculateInvoiceDate } from '../credit-cards/helpers/invoice-calculator.helper';

@Controller('card-transactions')
export class CardTransactionsController {
    constructor(
        private readonly cardTransactionsService: CardTransactionsService,
        private readonly pdfParserService: PdfParserService,
        private readonly prisma: PrismaService,
    ) {}

    @Post()
    @RequirePermissions('create:cartao')
    create(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Body() createCardTransactionDto: CreateCardTransactionDto,
    ) {
        return this.cardTransactionsService.create(ctx.workspaceId, createCardTransactionDto);
    }

    @Post('preview')
    @RequirePermissions('view:cartao')
    simulate(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Body() createCardTransactionDto: CreateCardTransactionDto,
    ) {
        return this.cardTransactionsService.simulate(ctx.workspaceId, createCardTransactionDto);
    }

    // ---- PDF Import ----

    @Post('import-pdf')
    @RequirePermissions('create:cartao')
    @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
    async importPdf(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @UploadedFile() file: Express.Multer.File,
        @Query('creditCardId') creditCardId: string,
        @Query('password') password?: string,
    ) {
        if (!file) throw new BadRequestException('No file uploaded.');
        if (!file.buffer || file.buffer.length === 0) throw new BadRequestException('File buffer is empty. Ensure the file was sent as multipart/form-data.');
        if (!creditCardId) throw new BadRequestException('creditCardId query param is required.');

        try {
            const categories = await this.prisma.category.findMany({
                where: { workspaceId: ctx.workspaceId },
                select: { id: true, name: true },
            });
            const parsed = await this.pdfParserService.parseStatementPdf(file.buffer, categories, password || undefined);
            return { transactions: parsed, count: parsed.length };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new BadRequestException(`Falha ao processar o PDF: ${msg}. Verifique se o arquivo não está corrompido ou se a senha está correta.`);
        }
    }

    /** Debug endpoint — returns raw extracted text lines for regex tuning */
    @Post('import-pdf/debug')
    @RequirePermissions('create:cartao')
    @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
    async debugPdf(
        @UploadedFile() file: Express.Multer.File,
        @Query('password') password?: string,
    ) {
        if (!file) throw new BadRequestException('No file uploaded.');
        try {
            const rawText = await this.pdfParserService.extractRawText(file.buffer, password || undefined);
            const lines = rawText.split('\n');
            return { totalLines: lines.length, lines };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new BadRequestException(`Falha ao extrair texto: ${msg}`);
        }
    }

    @Post('import-pdf/confirm')
    @RequirePermissions('create:cartao')
    async confirmImport(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Body() body: { creditCardId: string; transactions: (ParsedTransaction & { cardHolderId?: string })[] },
    ) {
        const { creditCardId, transactions } = body;
        if (!creditCardId || !transactions?.length) {
            throw new BadRequestException('creditCardId and transactions are required.');
        }

        const card = await this.prisma.creditCard.findFirst({ where: { id: creditCardId, workspaceId: ctx.workspaceId } });
        if (!card) throw new BadRequestException('Credit card not found.');

        let totalRecords = 0;
        for (const tx of transactions) {
            const created = await this.cardTransactionsService.createFromPdfImport(ctx.workspaceId, {
                description: tx.description,
                amount: tx.amount,
                date: tx.date,
                creditCardId,
                cardHolderId: tx.cardHolderId ?? null,
                categoryId: tx.suggestedCategoryId ?? null,
                installmentsCurrent: tx.installmentsCurrent ?? null,
                installmentsTotal: tx.installmentsTotal ?? null,
            });
            totalRecords += created.length;
        }

        return { imported: transactions.length, records: totalRecords };
    }

    // ---- Standard Routes ----

    @Post(':id/estorno')
    @RequirePermissions('create:cartao')
    async createEstorno(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('id') id: string,
        @Body() body: { amount?: number; date?: string },
    ) {
        const original = await this.prisma.cardTransaction.findFirst({
            where: { id, workspaceId: ctx.workspaceId },
        });
        if (!original) throw new BadRequestException('Transaction not found.');

        const reverseAmount = body.amount && body.amount > 0 ? body.amount : original.amount;
        const reverseDate = body.date ? new Date(body.date) : new Date();

        const creditCard = await this.prisma.creditCard.findFirst({
            where: { id: original.creditCardId, workspaceId: ctx.workspaceId },
        });
        if (!creditCard) throw new BadRequestException('Credit card not found.');

        const invoiceDate = calculateInvoiceDate(reverseDate, (creditCard as any).invoiceClosingOffset, creditCard.dueDay);

        return this.prisma.cardTransaction.create({
            data: {
                workspaceId: ctx.workspaceId,
                description: `Estorno - ${original.description}`,
                amount: -reverseAmount,
                date: reverseDate,
                invoiceDate,
                installments: 1,
                creditCardId: original.creditCardId,
                cardHolderId: original.cardHolderId,
                categoryId: original.categoryId,
                installmentGroupId: null,
            } as any,
        });
    }

    @Get('summary/invoice')
    @RequireAnyPermissions('view:cartao', 'view:resumo')
    getInvoiceSummary(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Query('month') monthString: string,
        @Query('year') yearString: string,
    ) {
        const month = parseInt(monthString, 10);
        const year = parseInt(yearString, 10);

        if (isNaN(month) || isNaN(year)) {
            throw new BadRequestException('Month and year queries are required and must be numbers.');
        }

        return this.cardTransactionsService.getInvoiceSummary(ctx.workspaceId, month, year);
    }

    @Get(':creditCardId/invoice')
    @RequirePermissions('view:cartao')
    getInvoice(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('creditCardId') creditCardId: string,
        @Query('month') monthString: string,
        @Query('year') yearString: string,
    ) {
        const month = parseInt(monthString, 10);
        const year = parseInt(yearString, 10);

        if (isNaN(month) || isNaN(year)) {
            throw new BadRequestException('Month and year queries are required and must be numbers.');
        }

        return this.cardTransactionsService.findAllByInvoice(ctx.workspaceId, creditCardId, month, year);
    }

    @Delete(':id')
    @RequirePermissions('delete:cartao')
    remove(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('id') id: string,
        @Query('mode') mode?: 'SINGLE' | 'FUTURE' | 'ALL',
    ) {
        const deletionMode = mode || 'SINGLE';

        if (!['SINGLE', 'FUTURE', 'ALL'].includes(deletionMode)) {
            throw new BadRequestException('Invalid deletion mode. Use SINGLE, FUTURE, or ALL.');
        }

        return this.cardTransactionsService.remove(ctx.workspaceId, id, deletionMode);
    }

    @Patch(':id')
    @RequirePermissions('edit:cartao')
    update(
        @CurrentWorkspace() ctx: WorkspaceRequestContext,
        @Param('id') id: string,
        @Body() updateCardTransactionDto: UpdateCardTransactionDto,
    ) {
        return this.cardTransactionsService.update(ctx.workspaceId, id, updateCardTransactionDto);
    }
}
