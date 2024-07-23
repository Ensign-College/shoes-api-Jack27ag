FROM  node:18-alpine3.19
WORKDIR /app
COPY package.json .
RUN npm install
COPY .env ./
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start"]
