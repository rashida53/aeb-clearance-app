const nodemailer = require('nodemailer');

module.exports = {
    SendHtmlEmail: function (authEmail, authPass, receiverEmails, emailSubject, emailHtml, bccEmails) {
        let recipients = receiverEmails;
        if (typeof receiverEmails === 'string') {
            recipients = receiverEmails.split(',').map(email => email.trim()).filter(email => email);
        }

        if (!recipients || recipients.length === 0) {
            console.log('No recipients provided for email notification');
            return;
        }

        let bccRecipients = bccEmails || [];
        if (typeof bccEmails === 'string') {
            bccRecipients = bccEmails.split(',').map(email => email.trim()).filter(email => email);
        }

        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: authEmail,
                pass: authPass,
            }
        });

        const mailOptions = {
            from: authEmail,
            to: recipients.join(', '),
            subject: emailSubject,
            html: emailHtml,
        };

        if (bccRecipients.length > 0) {
            mailOptions.bcc = bccRecipients.join(', ');
        }

        return transporter.sendMail(mailOptions)
            .then(info => {
                console.log(`Email sent successfully: ${info.messageId}`);
            });
    },

    // Sends an email with an attached iCalendar (REQUEST) event so Gmail and other
    // clients recognize it as a calendar appointment.
    SendAppointmentEmail: function (authEmail, authPass, receiverEmails, emailSubject, emailHtml, icsContent) {
        let recipients = receiverEmails;
        if (typeof receiverEmails === 'string') {
            recipients = receiverEmails.split(',').map(email => email.trim()).filter(email => email);
        }

        if (!recipients || recipients.length === 0) {
            console.log('No recipients provided for appointment email');
            return Promise.resolve();
        }

        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: authEmail,
                pass: authPass,
            }
        });

        const mailOptions = {
            from: authEmail,
            to: recipients.join(', '),
            subject: emailSubject,
            html: emailHtml,
            icalEvent: {
                method: 'REQUEST',
                filename: 'appointment.ics',
                content: icsContent,
            },
        };

        return transporter.sendMail(mailOptions)
            .then(info => {
                console.log(`Appointment email sent successfully: ${info.messageId}`);
            });
    }
};
