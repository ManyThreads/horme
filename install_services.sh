# we invoke these in the top level dir of horme to capture /common in the docker context
docker build -t ceiling-lamp -f services/ceiling-lamp/Dockerfile .
docker build -t failure-reasoner -f services/failure-reasoner/Dockerfile .
docker build -t light-switch -f services/light-switch/Dockerfile .
cd services/camera-motion-detect
./docker_build.sh
cd ../..
