describe('Cartões Dashboard', () => {
    it('should render the progress bar with correct limit usage percentage', () => {
        cy.visit('/cartoes');

        // Check if the percentage text is rendered correctly (1350.50 / 5000 = 27.0%)
        cy.contains('27.0%').should('be.visible');

        // The progress bar indicator translates depending on the value
        // 100 - 27.01 = ~72.99
        // So we check if the style transform includes a translation close to -73%
        cy.get('[data-slot="progress-indicator"]')
            .should('have.attr', 'style')
            .and('include', 'transform:translateX(-72.99%)');
    });

    it('should switch tabs and display corresponding invoices', () => {
        cy.visit('/cartoes');

        // By default "Fev" is selected, so we should see "Restaurante Coco Bambu" and "Passagem Aérea 1/5"
        cy.contains('Restaurante Coco Bambu').should('be.visible');
        cy.contains('1/5').should('be.visible');

        // Click on "Março" Tab
        cy.contains('Março').click();

        // Now we should see the "3/3" and "2/5" installments, but "Restaurante Coco Bambu" should disappear
        cy.contains('3/3').should('be.visible');
        cy.contains('2/5').should('be.visible');
        cy.contains('Restaurante Coco Bambu').should('not.exist');

        // Click on "Janeiro" Tab
        cy.contains('Janeiro').click();

        // We should see "1/3"
        cy.contains('1/3').should('be.visible');
    });
});
