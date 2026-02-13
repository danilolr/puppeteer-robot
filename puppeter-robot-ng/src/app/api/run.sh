sudo rm -rf puppeteer-robot-api

docker run --rm -v "${PWD}:/local" openapitools/openapi-generator-cli:v7.15.0 generate \
    -i http://puppeteer-api.100.83.43.122.nip.io/puppeteer-robot/api/v1/swagger-json \
    -g typescript-fetch  \
    -o /local/puppeteer-robot-api --skip-validate-spec

sudo chown $USER:$USER puppeteer-robot-api -R