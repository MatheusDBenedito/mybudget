import { Module } from '@nestjs/common';
import { MilesController } from './miles.controller';
import { MilesService } from './miles.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [MilesController],
    providers: [MilesService],
})
export class MilesModule { }
