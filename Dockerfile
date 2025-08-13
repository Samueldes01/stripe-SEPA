FROM ruby:3.2-alpine

# Paquets légers
RUN apk add --no-cache build-base

WORKDIR /app
COPY Gemfile Gemfile.lock* ./
RUN bundle install

COPY . .

ENV RACK_ENV=production
# Cloud Run utilisera $PORT
EXPOSE 8080
CMD ["ruby", "server.rb"]
