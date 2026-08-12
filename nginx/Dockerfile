FROM nginx:alpine

# Install openssl to generate self-signed certificates for startup fallback
RUN apk add --no-cache openssl

# Remove default configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy configurations
COPY nginx.conf /etc/nginx/nginx.conf
COPY quizverse.conf /etc/nginx/conf.d/quizverse.conf

# Create directory for SSL certificates
RUN mkdir -p /etc/nginx/ssl

# Generate default self-signed SSL certificates so the container builds and runs immediately
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/quizverse.key \
    -out /etc/nginx/ssl/quizverse.crt \
    -subj "/C=US/ST=State/L=City/O=QuizVerse/CN=localhost"

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
