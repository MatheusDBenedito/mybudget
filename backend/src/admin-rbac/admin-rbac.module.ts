import { Module } from '@nestjs/common';
import { AdminRbacController } from './admin-rbac.controller';
import { AdminRbacService } from './admin-rbac.service';

@Module({
    controllers: [AdminRbacController],
    providers: [AdminRbacService],
})
export class AdminRbacModule {}

