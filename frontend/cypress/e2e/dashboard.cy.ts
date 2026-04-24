describe('Dashboard Cash Flow', () => {
    it('should format values correctly as BRL', () => {
        cy.visit('/');

        // Renda Fixa was 5500.00 -> R$ 5.500,00
        cy.contains('R$ 5.500,00').should('be.visible');

        // Mercado Assaí was 350.75 -> R$ 350,75
        cy.contains('R$ 350,75').should('be.visible');

        // MOCK_TRANSACTIONS contain 5500.00 + 45.20 = 5545.20 INCOME
        // and 350.75 + 120.00 + 55.90 = 526.65 EXPENSE
        // Balance should be 5545.20 - 526.65 = 5018.55
        cy.contains('Saldo Atual').parent().find('.text-2xl').invoke('text').should((text) => {
            // Int.NumberFormat automatically adds non-breaking spaces occasionally depending on the locale engine.
            // So we just normalize spaces to check if the substring exists
            const normalizedStr = text.replace(/[\u00A0\u1680\u180e\u2000-\u200a\u202f\u205f\u3000]/g, ' ');
            expect(normalizedStr).to.include('R$ 5.018,55');
        });
    });

    it('should have a responsive table container', () => {
        cy.visit('/');
        // Set viewport to mobile standard
        cy.viewport('iphone-6');
        // Ensure the parent container has overflow-x-auto rendering it scrollable horizontally
        cy.get('table').parent().should('have.css', 'overflow-x', 'auto');
    });
});
