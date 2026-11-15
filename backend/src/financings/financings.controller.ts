import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  CurrentWorkspace,
  RequirePermissions,
  type WorkspaceRequestContext,
} from '../auth/decorators/permissions.decorator';
import {
  CreateExtraAmortizationDto,
  CreateFinancingDto,
  SimulateFinancingDto,
  UpdateFinancingDto,
  UpdateInstallmentStatusDto,
} from './dto/financing.dto';
import {
  type ConfirmStatementImportPayload,
  FinancingsService,
} from './financings.service';

@Controller('financings')
export class FinancingsController {
  constructor(private readonly financingsService: FinancingsService) {}

  @Get()
  @RequirePermissions('view:financiamentos')
  list(@CurrentWorkspace() ctx: WorkspaceRequestContext) {
    return this.financingsService.list(ctx.workspaceId);
  }

  @Get('benchmarks/cdi')
  @RequirePermissions('view:financiamentos')
  async getCdi() {
    const cdiAnnualRatePct = await this.financingsService.getCdiAnnualRatePct();
    return { cdiAnnualRatePct };
  }

  @Get('fixed-expenses')
  @RequirePermissions('view:financiamentos')
  getFixedExpenses(@CurrentWorkspace() ctx: WorkspaceRequestContext) {
    return this.financingsService.getFixedExpenseOptions(ctx.workspaceId);
  }

  @Get(':id')
  @RequirePermissions('view:financiamentos')
  getOne(
    @CurrentWorkspace() ctx: WorkspaceRequestContext,
    @Param('id') id: string
  ) {
    return this.financingsService.getOne(ctx.workspaceId, id);
  }

  @Get(':id/summary')
  @RequirePermissions('view:financiamentos')
  getSummary(
    @CurrentWorkspace() ctx: WorkspaceRequestContext,
    @Param('id') id: string
  ) {
    return this.financingsService.getDashboardSummary(ctx.workspaceId, id);
  }

  @Post()
  @RequirePermissions('create:financiamentos')
  create(
    @CurrentWorkspace() ctx: WorkspaceRequestContext,
    @Body() dto: CreateFinancingDto
  ) {
    return this.financingsService.create(ctx.workspaceId, dto);
  }

  @Patch(':id')
  @RequirePermissions('edit:financiamentos')
  update(
    @CurrentWorkspace() ctx: WorkspaceRequestContext,
    @Param('id') id: string,
    @Body() dto: UpdateFinancingDto
  ) {
    return this.financingsService.update(ctx.workspaceId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('delete:financiamentos')
  remove(
    @CurrentWorkspace() ctx: WorkspaceRequestContext,
    @Param('id') id: string
  ) {
    return this.financingsService.remove(ctx.workspaceId, id);
  }

  @Post(':id/simulate')
  @RequirePermissions('view:financiamentos')
  simulate(
    @CurrentWorkspace() ctx: WorkspaceRequestContext,
    @Param('id') id: string,
    @Body() dto: SimulateFinancingDto
  ) {
    return this.financingsService.simulate(ctx.workspaceId, id, dto);
  }

  @Post(':id/extra-amortizations')
  @RequirePermissions('edit:financiamentos')
  addExtraAmortization(
    @CurrentWorkspace() ctx: WorkspaceRequestContext,
    @Param('id') id: string,
    @Body() dto: CreateExtraAmortizationDto
  ) {
    return this.financingsService.addExtraAmortization(
      ctx.workspaceId,
      id,
      dto
    );
  }

  @Delete(':id/extra-amortizations/:extraId')
  @RequirePermissions('delete:financiamentos')
  deleteExtraAmortization(
    @CurrentWorkspace() ctx: WorkspaceRequestContext,
    @Param('id') id: string,
    @Param('extraId') extraId: string
  ) {
    return this.financingsService.deleteExtraAmortization(
      ctx.workspaceId,
      id,
      extraId
    );
  }

  @Patch(':id/installments/:installmentId')
  @RequirePermissions('edit:financiamentos')
  updateInstallmentStatus(
    @CurrentWorkspace() ctx: WorkspaceRequestContext,
    @Param('id') id: string,
    @Param('installmentId') installmentId: string,
    @Body() dto: UpdateInstallmentStatusDto
  ) {
    return this.financingsService.updateInstallmentStatus(
      ctx.workspaceId,
      id,
      installmentId,
      dto
    );
  }

  @Post('import/preview')
  @RequirePermissions('create:financiamentos')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async previewImport(
    @UploadedFile() file: Express.Multer.File,
    @Query('password') password?: string
  ) {
    if (!file || !file.buffer?.length) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }
    try {
      return await this.financingsService.previewStatementImport(
        file.buffer,
        file.originalname,
        password || undefined
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Falha ao ler extrato: ${msg}`);
    }
  }

  @Post('import/confirm')
  @RequirePermissions('create:financiamentos')
  confirmImport(
    @CurrentWorkspace() ctx: WorkspaceRequestContext,
    @Body() body: ConfirmStatementImportPayload
  ) {
    return this.financingsService.confirmStatementImport(ctx.workspaceId, body);
  }

  @Post('fgts/preview')
  @RequirePermissions('edit:financiamentos')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async previewFgtsImport(
    @UploadedFile() file: Express.Multer.File,
    @Query('password') password?: string
  ) {
    if (!file || !file.buffer?.length) {
      throw new BadRequestException('Nenhum arquivo FGTS enviado.');
    }
    try {
      return await this.financingsService.previewFgtsStatementImport(
        file.buffer,
        file.originalname,
        password || undefined
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Falha ao ler extrato do FGTS: ${msg}`);
    }
  }
}
