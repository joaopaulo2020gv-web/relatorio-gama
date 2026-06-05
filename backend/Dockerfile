FROM node:20

WORKDIR /usr/src/app

COPY package*.json ./

# Instala dependências (incluindo as nativas)
RUN npm install --only=production

COPY . .

EXPOSE 5000

ENV NODE_ENV=production

CMD ["npm", "start"]
