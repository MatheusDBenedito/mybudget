import { Controller, Post, Body, Get, Param, Query, BadRequestException, Delete, Patch, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
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
    ) { }

    @Post()
    create(@Body() createCardTransactionDto: CreateCardTransactionDto) {
        return this.cardTransactionsService.create(createCardTransactionDto);
    }

    @Post('preview')
    simulate(@Body() createCardTransactionDto: CreateCardTransactionDto) {
        return this.cardTransactionsService.simulate(createCardTransactionDto);
    }

    // ---- PDF Import ----

    @Post('import-pdf')
    @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
    async importPdf(
        @UploadedFile() file: Express.Multer.File,
        @Query('creditCardId') creditCardId: string,
        @Query('password') password?: string,
    ) {
        if (!file) throw new BadRequestException('No file uploaded.');
        if (!file.buffer || file.buffer.length === 0) throw new BadRequestException('File buffer is empty. Ensure the file was sent as multipart/form-data.');
        if (!creditCardId) throw new BadRequestException('creditCardId query param is required.');

        try {
            const categories = await this.prisma.category.findMany({ select: { id: true, name: true } });
            const parsed = await this.pdfParserService.parseStatementPdf(file.buffer, categories, password || undefined);
            return { transactions: parsed, count: parsed.length };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new BadRequestException(`Falha ao processar o PDF: ${msg}. Verifique se o arquivo não está corrompido ou se a senha está correta.`);
        }
    }

    /** Debug endpoint — returns raw extracted text lines for regex tuning */
    @Post('import-pdf/debug')
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
    async confirmImport(
        @Body() body: { creditCardId: string; transactions: ParsedTransaction[] },
    ) {
        const { creditCardId, transactions } = body;
        if (!creditCardId || !transactions?.length) {
            throw new BadRequestException('creditCardId and transactions are required.');
        }

        const card = await this.prisma.creditCard.findUnique({ where: { id: creditCardId } });
        if (!card) throw new BadRequestException('Credit card not found.');

        let totalRecords = 0;
        for (const tx of transactions) {
            const created = await this.cardTransactionsService.createFromPdfImport({
                description: tx.description,
                amount: tx.amount,
                date: tx.date,
                creditCardId,
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
    async createEstorno(
        @Param('id') id: string,
        @Body() body: { amount?: number; date?: string },
    ) {
        const original = await this.prisma.cardTransaction.findUnique({ where: { id } });
        if (!original) throw new BadRequestException('Transaction not found.');

        const reverseAmount = body.amount && body.amount > 0 ? body.amount : original.amount;
        const reverseDate = body.date ? new Date(body.date) : new Date();

        const creditCard = await this.prisma.creditCard.findUnique({ where: { id: original.creditCardId } });
        if (!creditCard) throw new BadRequestException('Credit card not found.');

        const invoiceDate = calculateInvoiceDate(reverseDate, (creditCard as any).invoiceClosingOffset, creditCard.dueDay);

        return this.prisma.cardTransaction.create({
            data: {
                description: `Estorno - ${original.description}`,
                amount: -reverseAmount,
                date: reverseDate,
                invoiceDate,
                installments: 1,
                creditCardId: original.creditCardId,
                categoryId: original.categoryId,
                installmentGroupId: null,
            } as any,
        });
    }

    @Get('summary/invoice')
    getInvoiceSummary(
        @Query('month') monthString: string,
        @Query('year') yearString: string,
    ) {
        const month = parseInt(monthString, 10);
        const year = parseInt(yearString, 10);

        if (isNaN(month) || isNaN(year)) {
            throw new BadRequestException('Month and year queries are required and must be numbers.');
        }

        return this.cardTransactionsService.getInvoiceSummary(month, year);
    }

    @Get(':creditCardId/invoice')
    getInvoice(
        @Param('creditCardId') creditCardId: string,
        @Query('month') monthString: string,
        @Query('year') yearString: string,
    ) {
        const month = parseInt(monthString, 10);
        const year = parseInt(yearString, 10);

        if (isNaN(month) || isNaN(year)) {
            throw new BadRequestException('Month and year queries are required and must be numbers.');
        }

        return this.cardTransactionsService.findAllByInvoice(creditCardId, month, year);
    }

    @Delete(':id')
    remove(
        @Param('id') id: string,
        @Query('mode') mode?: 'SINGLE' | 'FUTURE' | 'ALL',
    ) {
        const deletionMode = mode || 'SINGLE';

        if (!['SINGLE', 'FUTURE', 'ALL'].includes(deletionMode)) {
            throw new BadRequestException('Invalid deletion mode. Use SINGLE, FUTURE, or ALL.');
        }

        return this.cardTransactionsService.remove(id, deletionMode);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() updateCardTransactionDto: UpdateCardTransactionDto,
    ) {
        return this.cardTransactionsService.update(id, updateCardTransactionDto);
    }
}
