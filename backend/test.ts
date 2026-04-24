import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Apaga todas as exceções bugadas (isFixed false e description 'Teste fixo') que o usuário acabou criando.
    // Deixamos apenas a fixa original.
    const deleted = await prisma.cardTransaction.deleteMany({
        where: {
            description: { contains: 'Teste fixo' },
            isFixed: false
        }
    });
    console.log('Deletadas exceções bugadas:', deleted.count);

    // Limpamos a lista de ignorados do registro matriz para resetar o teste do usuário
    const updated = await prisma.cardTransaction.updateMany({
        where: {
            description: { contains: 'Teste fixo' },
            isFixed: true
        },
        data: {
            ignoredInvoices: null
        }
    });
    console.log('Recentes ignorados limpados:', updated.count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
