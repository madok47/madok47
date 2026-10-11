FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 BIRQALYP_DATA_DIR=/data
WORKDIR /app
RUN mkdir /data && chown node:node /data
COPY --chown=node:node package.json server.mjs index.html app.js style.css ./
COPY --chown=node:node vendor ./vendor
USER node
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "server.mjs"]
