import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const investments = await prisma.investment.findMany({
        where: {
            type: 'VARIABLE_INCOME'
        }
    })

    console.log('Available variable income investments:', investments)
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
