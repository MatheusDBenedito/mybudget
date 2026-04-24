import { distributeInstallments } from '../penny-pinching.helper';

describe('Penny Pinching Helper (distributeInstallments)', () => {
    it('should perfectly divide R$ 100,00 into 3 installments (33.34 + 33.33 + 33.33)', () => {
        const total = 100;
        const installments = 3;

        const result = distributeInstallments(total, installments);

        expect(result.length).toBe(3);

        // Verifica arredondamentos individuais
        expect(result[0]).toBe(33.34);
        expect(result[1]).toBe(33.33);
        expect(result[2]).toBe(33.33);

        // Sum check (Dica QA: O somatório das parcelas PRECISA bater exato com o total)
        const sum = result.reduce((acc, current) => acc + current, 0);
        expect(sum).toBe(100);
    });

    it('should perfectly divide R$ 10,00 into 3 installments (3.34 + 3.33 + 3.33)', () => {
        const result = distributeInstallments(10, 3);
        const sum = result.reduce((acc, current) => acc + current, 0);

        expect(sum).toBe(10);
        expect(result[0]).toBe(3.34);
        expect(result[2]).toBe(3.33);
    });

    it('should handle division without remainder (e.g., 90 into 3)', () => {
        const result = distributeInstallments(90, 3);
        const sum = result.reduce((acc, current) => acc + current, 0);

        expect(sum).toBe(90);
        expect(result[0]).toBe(30);
        expect(result[1]).toBe(30);
        expect(result[2]).toBe(30);
    });

    it('should handle single installment', () => {
        const result = distributeInstallments(12.34, 1);
        expect(result.length).toBe(1);
        expect(result[0]).toBe(12.34);
    });

    it('should handle distributing small change into large installments (e.g., 0.05 into 3)', () => {
        const result = distributeInstallments(0.05, 3);
        const sum = result.reduce((acc, current) => acc + current, 0);

        // Pelo algoritmo os 5 centavos vão 2 para a primeira parcela (1 + 1 centavo resto),
        // 2 para a segunda e 1 para a terceira (na base cents).
        expect(result[0]).toBe(0.02);
        expect(result[1]).toBe(0.02);
        expect(result[2]).toBe(0.01);

        // E o somatório precisa dar exato, contornando a falha nativa 0.02+0.02+0.01 != 0.05 
        // Em JS `0.02 + 0.02 + 0.01 === 0.05` é true. Em alguns casos extremos não é, mas toFixed(2) ajuda.
        // Usamos round aqui só para garantir o teste da soma de floats em JS se der quebrado no Reduce.
        expect(Math.round(sum * 100) / 100).toBe(0.05);
    });
});
