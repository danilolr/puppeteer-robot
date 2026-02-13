FROM  node:20-alpine
EXPOSE 3002
WORKDIR /opt/dev/servidor
RUN apk update
RUN apk upgrade 
RUN apk add tzdata --no-cache
RUN apk add chromium --no-cache
RUN apk add nss --no-cache
RUN apk add freetype --no-cache
RUN apk add harfbuzz --no-cache
RUN apk add ttf-freefont --no-cache   
ENV TZ="America/Sao_Paulo"
# ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
# ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN cp /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime
RUN npm i -g @nestjs/cli
COPY src/ /opt/dev/servidor/src
COPY *.json /opt/dev/servidor/
RUN mkdir /opt/dev/data
RUN mkdir /opt/dev/temp
RUN npm install
RUN npm run-script build --prod
CMD node dist/main.js