FROM node:20-alpine

WORKDIR /app

# Copy shared library
COPY shared/ ./shared/

# Copy service files
COPY services/student-service/package*.json ./services/student-service/
WORKDIR /app/services/student-service
RUN npm install --production

COPY services/student-service/src/ ./src/
COPY services/student-service/data/ ./data/

EXPOSE 8001

CMD ["node", "src/index.js"]
