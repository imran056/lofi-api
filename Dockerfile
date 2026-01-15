FROM node:18-slim

# Install FFmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app files
COPY . .

# Create directories
RUN mkdir -p uploads outputs

EXPOSE 3080

CMD ["node", "server.js"]
