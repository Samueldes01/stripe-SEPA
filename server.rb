# server.rb
# Sinatra webhook receiver for Stripe + email via SendGrid
require 'sinatra'
require 'json'
require 'stripe'
require 'sendgrid-ruby'

# --- Config depuis les variables d'environnement ---
Stripe.api_key = ENV.fetch('STRIPE_API_KEY')            # sk_test_... ou sk_live_...
ENDPOINT_SECRET = ENV.fetch('STRIPE_WEBHOOK_SECRET')    # whsec_...
SENDGRID_API_KEY = ENV.fetch('SENDGRID_API_KEY')
NOTIFY_EMAIL = ENV.fetch('NOTIFY_EMAIL', 'desplat.samuel@outlook.be') # destinataire par défaut
FROM_EMAIL   = ENV.fetch('FROM_EMAIL', 'noreply@example.com')         # doit être validée dans SendGrid

set :bind, '0.0.0.0'
set :port, ENV.fetch('PORT', 8080)

# Healthcheck
get '/' do
  'ok'
end

# Stripe a besoin du body BRUT -> pas de middleware JSON ici
post '/stripe/webhook' do
  payload = request.body.read
  sig_header = request.env['HTTP_STRIPE_SIGNATURE']
  event = nil

  begin
    event = Stripe::Webhook.construct_event(payload, sig_header, ENDPOINT_SECRET)
  rescue JSON::ParserError
    status 400 and return 'Invalid payload'
  rescue Stripe::SignatureVerificationError
    status 400 and return 'Invalid signature'
  end

  begin
    case event['type']
    when 'checkout.session.completed'
      session = event['data']['object']
      send_email(
        'Checkout complété',
        "La session #{session['id']} est terminée pour le client #{session['customer_details']&.dig('email') || 'inconnu'}. "\
        "Pour SEPA, le paiement peut encore être en traitement."
      )

    when 'payment_intent.succeeded'
      pi = event['data']['object']
      amount = (pi['amount_received'] || pi['amount']) .to_i / 100.0
      currency = (pi['currency'] || 'eur').upcase
      send_email(
        'Paiement confirmé',
        "Paiement #{pi['id']} confirmé : #{amount} #{currency}. Client: #{pi['charges']&.dig('data', 0, 'billing_details', 'email') || 'N/A'}"
      )

    when 'invoice.paid'
      invoice = event['data']['object']
      amount = invoice['amount_paid'].to_i / 100.0
      currency = invoice['currency'].upcase
      send_email(
        'Facture d’abonnement payée',
        "Invoice #{invoice['id']} payée : #{amount} #{currency} (customer #{invoice['customer']})."
      )

    when 'payment_intent.payment_failed'
      pi = event['data']['object']
      msg = pi.dig('last_payment_error', 'message') || 'Raison inconnue'
      send_email(
        'Paiement échoué',
        "Le paiement #{pi['id']} a échoué. Raison: #{msg}."
      )

    when 'payment_intent.canceled'
      pi = event['data']['object']
      send_email('Paiement annulé', "Le PaymentIntent #{pi['id']} a été annulé.")

    else
      puts "Unhandled event type: #{event['type']}"
    end

    status 200
  rescue => e
    warn "Erreur traitement webhook: #{e.message}\n#{e.backtrace.join("\n")}"
    status 500
  end
end

# --- Envoi d'e-mail via SendGrid ---
def send_email(subject, text)
  sg = SendGrid::API.new(api_key: SENDGRID_API_KEY)
  mail = SendGrid::Mail.new
  mail.from = SendGrid::Email.new(email: FROM_EMAIL)
  mail.subject = subject
  personalization = SendGrid::Personalization.new
  personalization.add_to(SendGrid::Email.new(email: NOTIFY_EMAIL))
  mail.add_personalization(personalization)
  mail.add_content(SendGrid::Content.new(type: 'text/plain', value: text))
  resp = sg.client.mail._('send').post(request_body: mail.to_json)
  puts "📧 Email status: #{resp.status_code}"
rescue => e
  warn "Erreur envoi email: #{e.message}"
end
