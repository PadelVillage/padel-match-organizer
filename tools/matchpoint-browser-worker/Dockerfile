FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev
RUN npx playwright install --with-deps chromium

COPY src ./src

EXPOSE 10000

CMD ["npm", "start"]
