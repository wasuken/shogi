# Use a slim Node.js image
FROM node:20-slim

# Set the working directory
WORKDIR /app

# Copy package manifests
COPY package.json package-lock.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy the rest of the application source code
COPY . .

# Build the TypeScript code
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

# Set the command to start the server
CMD ["npm", "run", "start"]
