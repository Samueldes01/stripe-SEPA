// server.js
import express from "express";
import Stripe from "stripe";
import sgMail from "@sendgrid/mail";

const app = express();

// Config
const stripe = new Stripe(process.env.STRIPE_API_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Route healthcheck
app.get("/", (_req, res) => res.status(200).send("ok"));

// Route Webhook (body brut obligatoire)
app.post("/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = Stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("❌ Signature invalide:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        console.log("🟡 Checkout terminé:", session.id);
        // Email optionnel pour dire "paiement en cours"
        await sendEmail("Checkout complété", `Session ${session.id} terminée, en attente de confirmation.`);
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        console.log("✅ Paiement confirmé:", pi.id);
        await sendEmail(
          "Paiement confirmé",
          `Paiement ${pi.id} confirmé pour ${pi.amount_received / 100} ${pi.currency.toUpperCase()}.`
        );
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object;
        console.log("📄 Facture payée:", invoice.id);
        await sendEmail(
          "Facture payée",
          `Facture ${invoice.id} payée, montant: ${invoice.amount_paid / 100} ${invoice.currency.toUpperCase()}.`
        );
        break;
      }
      default:
        console.log("ℹ️ Événement reçu:", event.type);
    }

    res.status(200).send("ok");
  } catch (err) {
    console.error("Erreur traitement webhook:", err);
    res.status(500).send("server error");
  }
});

// Fonction d'envoi d'email
async function sendEmail(subject, text) {
  const msg = {
    to: process.env.NOTIFY_EMAIL, // Destinataire
    from: process.env.FROM_EMAIL, // Expéditeur vérifié dans SendGrid
    subject,
    text,
  };
  try {
    await sgMail.send(msg);
    console.log("📧 Email envoyé !");
  } catch (error) {
    console.error("Erreur envoi email:", error);
  }
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
