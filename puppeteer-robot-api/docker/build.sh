VERSION=$(node -p "require('../package.json').version")
echo "Building image version: $VERSION"
docker buildx build --platform linux/arm64,linux/amd64 -t danilolr/puppeteer-robot-api:$VERSION -t danilolr/puppeteer-robot-api:latest -f Dockerfile --push ..