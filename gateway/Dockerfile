FROM node:20-alpine

WORKDIR /app

# Copy shared library
COPY shared/ ./shared/

COPY gateway/package*.json ./gateway/
WORKDIR /app/gateway
RUN npm install --production

COPY gateway/src/ ./src/

EXPOSE 8000

CMD ["node", "src/index.js"]
