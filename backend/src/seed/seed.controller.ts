import { Controller, Post, HttpCode } from '@nestjs/common';
import { RequireSuperAdmin } from '../auth/decorators/permissions.decorator';
import { SeedService } from './seed.service';

@Controller('seed')
@RequireSuperAdmin()
export class SeedController {
    constructor(private readonly seedService: SeedService) {}

    @Post()
    @HttpCode(200)
    executeSeed() {
        return this.seedService.executeSeed();
    }
}
