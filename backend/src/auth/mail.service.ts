import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface SendPasswordResetEmailParams {
    to: string;
    name: string;
    resetUrl: string;
    ttlMinutes: number;
}

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);

    async sendPasswordResetEmail(params: SendPasswordResetEmailParams): Promise<void> {
        const subject = 'Redefinição de senha — MyFinance';
        const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; color: #1c1f24;">
                <h2 style="margin-bottom: 12px;">Redefinição de senha</h2>
                <p>Olá, ${this.escapeHtml(params.name)}.</p>
                <p>Recebemos uma solicitação para redefinir a senha da sua conta no <strong>MyFinance</strong>.</p>
                <p style="margin: 24px 0;">
                    <a href="${params.resetUrl}" style="display: inline-block; background-color: #1c1f24; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: 600;">
                        Redefinir minha senha
                    </a>
                </p>
                <p style="font-size: 13px; color: #525866;">
                    Este link expira em <strong>${params.ttlMinutes} minutos</strong> e pode ser utilizado apenas uma vez.
                </p>
                <p style="font-size: 13px; color: #525866;">
                    Se você não solicitou a redefinição de senha, ignore este e-mail com segurança.
                </p>
                <hr style="border: none; border-top: 1px solid #e3e5e9; margin: 20px 0;" />
                <p style="font-size: 12px; color: #7b8190; word-break: break-all;">
                    Caso o botão não funcione, copie e cole este link no navegador:<br />
                    ${params.resetUrl}
                </p>
            </div>
        `.trim();

        const text = [
            `Olá, ${params.name}.`,
            '',
            'Recebemos uma solicitação para redefinir a senha da sua conta no MyFinance.',
            `Acesse o link abaixo (válido por ${params.ttlMinutes} minutos):`,
            params.resetUrl,
            '',
            'Se você não solicitou isso, ignore este e-mail.',
        ].join('\n');

        const brevoApiKey = process.env.BREVO_API_KEY?.trim();
        const smtpHost = process.env.SMTP_HOST?.trim();

        if (brevoApiKey) {
            await this.sendViaBrevo(brevoApiKey, params.to, params.name, subject, html, text);
            return;
        }

        if (smtpHost) {
            await this.sendViaSmtp(smtpHost, params.to, subject, html, text);
            return;
        }

        // Dev/local fallback when no mail provider is configured
        this.logger.warn(
            `Nenhum provedor de e-mail configurado (BREVO_API_KEY ou SMTP_HOST). Link de redefinição para ${params.to}: ${params.resetUrl}`,
        );
    }

    private async sendViaBrevo(
        apiKey: string,
        toEmail: string,
        toName: string,
        subject: string,
        htmlContent: string,
        textContent: string,
    ): Promise<void> {
        const senderEmail = process.env.MAIL_FROM?.trim() || process.env.SMTP_USER?.trim();
        if (!senderEmail) {
            throw new Error('MAIL_FROM é obrigatório para envio via Brevo.');
        }
        const senderName = process.env.MAIL_FROM_NAME?.trim() || 'MyFinance';

        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
            },
            body: JSON.stringify({
                sender: { email: senderEmail, name: senderName },
                to: [{ email: toEmail, name: toName }],
                subject,
                htmlContent,
                textContent,
            }),
        });

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            this.logger.error(`Erro ao enviar e-mail via Brevo (${res.status}): ${body}`);
            throw new Error(`Falha ao enviar e-mail via Brevo (${res.status}).`);
        }
    }

    private async sendViaSmtp(
        host: string,
        to: string,
        subject: string,
        html: string,
        text: string,
    ): Promise<void> {
        const port = Number(process.env.SMTP_PORT || 587);
        const user = process.env.SMTP_USER?.trim();
        const pass = process.env.SMTP_PASS?.trim();
        const from = process.env.MAIL_FROM?.trim() || user || 'no-reply@myfinance.local';

        const transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: user && pass ? { user, pass } : undefined,
        });

        await transporter.sendMail({ from, to, subject, html, text });
    }

    private escapeHtml(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
