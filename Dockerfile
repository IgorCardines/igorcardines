FROM node:20-alpine
WORKDIR /app
COPY server.mjs ./
COPY public ./public
COPY private ./private
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
