import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { MilesService } from './miles.service';
import { CreateMilesEntryDto } from './dto/create-miles-entry.dto';
import { UpdateMilesEntryDto } from './dto/update-miles-entry.dto';

@Controller('miles')
export class MilesController {
    constructor(private readonly milesService: MilesService) { }

    @Post()
    create(@Body() dto: CreateMilesEntryDto) {
        return this.milesService.create(dto);
    }

    @Get()
    findAll() {
        return this.milesService.findAll();
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateMilesEntryDto) {
        return this.milesService.update(id, dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.milesService.remove(id);
    }
}
