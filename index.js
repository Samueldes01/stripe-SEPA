import express from "express";
import Stripe from "stripe";
import Brevo from "@getbrevo/brevo";

const app = express();

/** Routes de diagnostic */
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
    // Vérifie la signature Stripe
    event = Stripe.webhooks.constructEvent(req.body, signature, endpointSecret);
  } catch (err) {
    console.error("Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "payment_intent.processing": {
        const pi = event.data.object;
        await sendEmail({
          subject: "Stripe: paiement en cours de traitement",
          text: `PaymentIntent ${pi.id} est en statut 'processing' pour ${formatAmount(pi.amount, pi.currency)}.`
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
      default:
        // autres événements ignorés
        break;
    }

    return res.status(200).send("[OK]");
  } catch (err) {
    console.error("Handler error:", err);
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

  await api.sendTransacEmail(email);
}

/** Démarrage serveur — Cloud Run exige 0.0.0.0 et le port $PORT */
const port = process.env.PORT || 8080;
app.listen(port, "0.0.0.0", () => {
  console.log(`Listening on 0.0.0.0:${port}`);
});
