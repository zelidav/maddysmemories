FROM node:20-slim

# sharp needs libvips runtime; node:20-slim ships with what sharp's prebuilt binary needs.
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY index.js ./

ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
