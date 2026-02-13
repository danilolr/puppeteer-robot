VERSION=$(node -p "require('../package.json').version")
echo "Building image version: $VERSION"
docker buildx build --platform linux/arm64 -t danilolr/puppeter-robot-api-arm:$VERSION -f Dockerfile.arm64 --push ..
docker buildx build --platform linux/amd64 -t danilolr/puppeter-robot-api-amd:$VERSION -f Dockerfile.amd64 --push ..