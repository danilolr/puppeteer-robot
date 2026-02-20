VERSION=$(cat ../package.json | jq -r .version)

cd ..
rm dist -rf
npm run set-version
ng build --configuration
cd docker
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes
docker buildx create --name mybuilder 2>/dev/null
docker buildx use mybuilder
docker buildx build --platform linux/arm64,linux/amd64 -t danilolr/puppeteer-robot-ng:$VERSION -t danilolr/puppeteer-robot-ng:latest -f Dockerfile --push ..