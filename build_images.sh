docker build -t horme-service-builder ./horme-common/
docker build -t ceiling-lamp ./services/ceiling-lamp/
docker build -t light-switch ./services/light-switch/
docker build -t reconf ./reconf/
#docker build -t failure-reasoner -f services/failure-reasoner/Dockerfile .
#cd services/camera-motion-detect
#./docker_build.sh
#cd ../..
