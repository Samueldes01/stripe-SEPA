// index.js — Cloud Run + Stripe Webhook + Brevo (Sendinblue)

import express from "express";
import Stripe from "stripe";
import Brevo from "@getbrevo/brevo";

const app = express();

/** Routes de diagnostic (health checks) */
app.get("/", (_req, res) => res.status(200).send("up"));
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

/**
 * Webhook Stripe
 * IMPORTANT : utiliser le RAW body pour vérifier la signature Stripe.
 * On applique express.raw UNIQUEMENT sur /webhook.
 */
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers["stripe-signature"];

  if (!endpointSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return res.status(500).send("Server not configured");
  }

  let event;
  try {
    // Vérifie que l'événement vient bien de Stripe
    event = Stripe.webhooks.constructEvent(req.body, signature, endpointSecret);
  } catch (err) {
    console.error("Signature verification failed:", err?.message || err);
    return res.status(400).send(`Webhook Error: ${err?.message || "invalid signature"}`);
  }

  try {
    console.log("Received event:", event.type);

    switch (event.type) {
      // --- Payment Intents ---
      case "payment_intent.processing": {
        const pi = event.data.object;
        await sendEmail({
          subject: "Stripe: paiement en cours de traitement",
          text: `PaymentIntent ${pi.id} est en 'processing' pour ${formatAmount(pi.amount, pi.currency)}.`
        });
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        await sendEmail({
          subject: "Stripe: paiement réussi",
          text: `PaymentIntent ${pi.id} réussi pour ${formatAmount(pi.amount, pi.currency)}.`
        });
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        await sendEmail({
          subject: "Stripe: paiement échoué",
          text: `PaymentIntent ${pi.id} a échoué. Raison: ${pi.last_payment_error?.message ?? "inconnue"}.`
        });
        break;
      }

      // --- Checkout ---
      case "checkout.session.completed": {
        const s = event.data.object;
        await sendEmail({
          subject: "Stripe: Checkout terminé",
          text: `Checkout ${s.id} complété. Mode: ${s.mode}. Montant total: ${s.amount_total ?? "?"} ${s.currency ?? ""}.`
        });
        break;
      }

      // --- Invoices / Charges (utile pour tests) ---
      case "invoice.paid": {
        const inv = event.data.object;
        await sendEmail({
          subject: "Stripe: facture payée",
          text: `Invoice ${inv.id} payée pour ${formatAmount(inv.amount_paid, inv.currency)}.`
        });
        break;
      }
      case "charge.succeeded": {
        const ch = event.data.object;
        await sendEmail({
          subject: "Stripe: charge réussie",
          text: `Charge ${ch.id} réussie pour ${formatAmount(ch.amount, ch.currency)}.`
        });
        break;
      }

      default:
        console.log("Event not handled explicitly:", event.type);
        break;
    }

    // Toujours répondre 200 si le traitement s'est bien passé
    return res.status(200).send("[OK]");
  } catch (err) {
    console.error("Handler error:", err);
    // 5xx => Stripe retentera automatiquement
    return res.status(500).send("Internal error");
  }
});

/** Pour toutes les autres routes éventuelles, parser le JSON (après /webhook) */
app.use(express.json());

/** Helpers */
function formatAmount(amountInMinor, currency) {
  const digits = ["jpy", "krw"].includes((currency || "").toLowerCase()) ? 0 : 2;
  return `${(amountInMinor / 10 ** digits).toFixed(digits)} ${String(currency || "").toUpperCase()}`;
}

async function sendEmail({ subject, text }) {
  const apiKey = process.env.BREVO_API_KEY;
  const to = process.env.MAIL_TO;
  const from = process.env.MAIL_FROM;

  if (!apiKey || !to || !from) {
    console.error("Missing email env vars (BREVO_API_KEY, MAIL_TO, MAIL_FROM)");
    return;
  }

  const api = new Brevo.TransactionalEmailsApi();
  api.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);

  const email = {
    to: [{ email: to }],
    sender: { email: from, name: "Stripe Webhooks" },
    subject,
    textContent: text
  };

  try {
    const resp = await api.sendTransacEmail(email);
    console.log("Brevo OK:", resp?.messageId || JSON.stringify(resp));
  } catch (e) {
    // Log d'erreur détaillé pour debug Cloud Run
    const body = e?.response?.text || e?.response?.body || e?.message || String(e);
    console.error("Brevo error:", body);
  }
}

/** Démarrage serveur — Cloud Run exige 0.0.0.0 et le port $PORT */
const port = process.env.PORT || 8080;
app.listen(port, "0.0.0.0", () => {
  console.log(`Listening on 0.0.0.0:${port}`);
});
