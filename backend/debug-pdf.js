const fs = require('fs');
const http = require('http');

const filePath = 'C:\\Users\\Matheus\\OneDrive\\Desktop\\fatura_2026-02-05 (1).pdf';
const password = '103382';

// Test the main import-pdf endpoint to see detected transactions
const fileBuffer = fs.readFileSync(filePath);
const boundary = '----FormBoundary' + Date.now();
const head = Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="fatura.pdf"\r\nContent-Type: application/pdf\r\n\r\n');
const tail = Buffer.from('\r\n--' + boundary + '--\r\n');
const body = Buffer.concat([head, fileBuffer, tail]);

// Use a fake creditCardId just to test parsing
const opts = {
    hostname: 'localhost', port: 3333,
    path: '/card-transactions/import-pdf?creditCardId=00000000-0000-0000-0000-000000000000&password=' + encodeURIComponent(password),
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary, 'Content-Length': body.length }
};

const req = http.request(opts, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        try {
            const j = JSON.parse(data);
            if (j.transactions) {
                console.log('Total detected:', j.count);
                j.transactions.forEach((tx, i) => {
                    console.log(`${i + 1}. [${tx.date}] ${tx.description} | ${tx.installmentsCurrent}/${tx.installmentsTotal} parcelas | R$ ${tx.amount} | cat: ${tx.suggestedCategoryId ? 'MATCHED' : 'NONE'}`);
                });
            } else {
                console.log('Response:', data.substring(0, 2000));
            }
        } catch (e) { console.log('Raw:', data.substring(0, 2000)); }
    });
});
req.on('error', e => console.error('Error:', e.message));
req.write(body);
req.end();
