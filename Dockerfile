FROM eclipse-temurin:17-jdk-alpine

# System packages
RUN apk add --no-cache \
    python3 py3-pip \
    nodejs npm \
    curl bash \
    ruby ruby-dev ruby-bundler \
    build-base libffi-dev \
    git

# Jekyll & Bundler (pre-bake common gems)
RUN gem install jekyll bundler --no-document
COPY Gemfile.prebake /tmp/Gemfile
RUN cd /tmp && bundle install --path /app/gems/vendor/bundle || true

# Node tools: SUSHI & GoFSH
RUN npm install -g fsh-sushi gofsh

# IG Publisher
RUN mkdir -p /app && \
    curl -fSL -o /app/publisher.jar \
    https://github.com/HL7/fhir-ig-publisher/releases/latest/download/publisher.jar

# Python app
COPY requirements.txt /app/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /app/requirements.txt

COPY api/ /app/api/

ENV PUBLISHER_JAR=/app/publisher.jar
ENV BUNDLE_PATH=/app/gems/vendor/bundle

WORKDIR /app
EXPOSE 8080

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8080"]
