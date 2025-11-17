FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate

RUN npm run build

EXPOSE 80
ENV PORT=80

CMD ["npm", "start"]
