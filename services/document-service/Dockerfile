FROM node:20-alpine

WORKDIR /app

# Copy shared library
COPY shared/ ./shared/

# Copy service files
COPY services/document-service/package*.json ./services/document-service/
WORKDIR /app/services/document-service
RUN npm install --production

COPY services/document-service/src/ ./src/
COPY services/document-service/storage/ ./storage/

EXPOSE 8003

CMD ["node", "src/index.js"]

