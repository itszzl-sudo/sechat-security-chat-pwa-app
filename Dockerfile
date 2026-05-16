FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache git openssh
COPY package*.json ./
RUN npm ci --only=production
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build
RUN rm -rf src/ tsconfig.json
VOLUME [ "/app/data", "/app/logs" ]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3   CMD node -e "try{require('http').get('http://localhost:3000/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1)}catch(e){process.exit(1)}"
CMD ["node", "dist/index.js"]
