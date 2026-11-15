FROM node:20-alpine

WORKDIR /app

# Copy shared library
COPY shared/ ./shared/

# Copy service files
COPY services/request-service/package*.json ./services/request-service/
WORKDIR /app/services/request-service
RUN npm install --production

COPY services/request-service/src/ ./src/
COPY services/request-service/data/ ./data/

EXPOSE 8002

CMD ["node", "src/index.js"]

