FROM node:20-alpine

WORKDIR /app

# Copy shared library
COPY shared/ ./shared/

# Copy service files
COPY services/notification-service/package*.json ./services/notification-service/
WORKDIR /app/services/notification-service
RUN npm install --production

COPY services/notification-service/src/ ./src/

EXPOSE 8004

CMD ["node", "src/index.js"]

