import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createAccountDto: CreateAccountDto) {
    return this.prisma.account.create({
      data: {
        name: createAccountDto.name,
        balance: createAccountDto.balance || 0,
      },
    });
  }

  async findAll() {
    return this.prisma.account.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    return account;
  }

  async update(id: string, updateAccountDto: UpdateAccountDto) {
    // Check if account exists first
    await this.findOne(id);

    return this.prisma.account.update({
      where: { id },
      data: updateAccountDto,
    });
  }

  async remove(id: string) {
    const account = await this.findOne(id);

    // Check if it's safe to delete (no transactions associated)
    const transactionsCount = await this.prisma.transaction.count({
      where: { accountId: id }
    });

    if (transactionsCount > 0) {
      throw new BadRequestException(`Cannot delete account with ID ${id} because it has ${transactionsCount} associated transactions.`);
    }

    // Also check for Card transactions or recurring expenses?
    // Let's count credit cards first
    const cardsCount = await this.prisma.creditCard.count({
      where: { accountId: id }
    });

    if (cardsCount > 0) {
      throw new BadRequestException(`Cannot delete account with ID ${id} because it has ${cardsCount} associated credit cards.`);
    }

    return this.prisma.account.delete({
      where: { id },
    });
  }
}
