FROM node:20-alpine

WORKDIR /app

COPY gateway/package*.json ./
RUN npm install --production

COPY gateway/src/ ./src/

EXPOSE 8000

CMD ["node", "src/index.js"]

