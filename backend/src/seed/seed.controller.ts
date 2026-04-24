import { Controller, Post, HttpCode } from '@nestjs/common';
import { SeedService } from './seed.service';

@Controller('seed')
export class SeedController {
    constructor(private readonly seedService: SeedService) { }

    @Post()
    @HttpCode(200)
    executeSeed() {
        return this.seedService.executeSeed();
    }
}
