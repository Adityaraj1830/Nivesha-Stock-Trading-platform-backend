const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendSupportEmail = async (ticket) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject: `New Support Ticket - ${ticket.ticketId}`,
    html: `
      <h2>New Support Ticket Received</h2>

      <p><strong>Ticket ID:</strong> ${ticket.ticketId}</p>

      <p><strong>Name:</strong> ${ticket.name}</p>

      <p><strong>Email:</strong> ${ticket.email}</p>

      <p><strong>Subject:</strong> ${ticket.subject}</p>

      <p><strong>Message:</strong></p>

      <p>${ticket.message}</p>

      <hr>

      <p><strong>Status:</strong> ${ticket.status}</p>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendSupportEmail };
