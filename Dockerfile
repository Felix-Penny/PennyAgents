FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the React client
RUN npm run build

# Remove dev dependencies to keep image small
RUN npm prune --production

EXPOSE $PORT

CMD ["npm", "start"]