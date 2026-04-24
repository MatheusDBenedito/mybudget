describe('Transaction Modal', () => {
    beforeEach(() => {
        cy.visit('/');
        // The button has "Nova Transação" text
        cy.contains('button', 'Nova Transação').click();
        // Verify the dialog opened by looking for the "Salvar Transação" button
        cy.contains('button', 'Salvar Transação').should('be.visible');
    });

    it('should display Zod validation errors on empty submission', () => {
        // Clear the default 0 amount just to trigger the required/invalid state if needed
        cy.get('input[name="amount"]').clear();

        // Submit the form
        cy.contains('button', 'Salvar Transação').click();

        // Check for specific validation errors
        cy.contains('A descrição deve ter pelo menos 3 caracteres.').should('be.visible');
        cy.contains('O valor deve ser maior que zero.').should('be.visible');
        cy.contains('Selecione uma categoria.').should('be.visible');
        // Date is pre-filled with new Date(), so it won't trigger an error by default
    });

    it('should open the DatePicker calendar', () => {
        // Look for the date picker button. It displays the currently selected date, but we can target the Popover trigger inside the Date field
        // The label is "Data", let's find the button next to it or just role="combobox" / check the structure.
        // The date button has text of the current date, but we know it's a button inside the form.
        // Let's click the button that has aria-haspopup="dialog" (Popover uses this) or just the button inside the Data Field
        cy.contains('label', 'Data').parent().find('button').click();

        // The calendar should be visible, meaning a dialog/popover with role="grid" or the calendar component
        cy.get('[data-slot="calendar"]').should('be.visible');
    });
});
