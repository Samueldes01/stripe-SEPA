FROM node:22-alpine

WORKDIR /usr/src/app

# Installer deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copier le code
COPY . .

ENV NODE_ENV=production
EXPOSE 8080

# IMPORTANT : démarre bien index.js
CMD ["node", "index.js"]
