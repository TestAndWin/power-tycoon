#!/bin/bash
# Deployment to MicroK8s on the server, same pattern as eat-hike-art (see docs/ARCHITECTURE.md → Deployment).
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP="power-tycoon"
IMAGE_NAME="${APP}:latest"
DATA_DIR="/srv/${APP}/data"
HOSTNAME="powertycoon.testandwin.de"

echo -e "${GREEN}=== Power Tycoon Deployment Script (MicroK8s) ===${NC}"

if command -v microk8s &> /dev/null; then
    KUBECTL="microk8s kubectl"
elif command -v kubectl &> /dev/null; then
    KUBECTL="kubectl"
else
    echo -e "${RED}Error: Neither microk8s nor kubectl found${NC}"
    exit 1
fi

check_prerequisites() {
    echo -e "\n${YELLOW}Checking prerequisites...${NC}"
    if ! command -v microk8s &> /dev/null; then
        echo -e "${RED}Error: MicroK8s is not installed${NC}"
        exit 1
    fi
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed${NC}"
        exit 1
    fi
    if ! microk8s status --wait-ready &> /dev/null; then
        echo -e "${YELLOW}Starting MicroK8s...${NC}"
        microk8s start
        microk8s status --wait-ready
    fi
    echo -e "${GREEN}Prerequisites OK${NC}"
}

# The container runs as user 1001 and needs a writable data directory for the SQLite file.
prepare_data_dir() {
    echo -e "\n${YELLOW}Preparing data directory ${DATA_DIR}...${NC}"
    if [ ! -d "${DATA_DIR}" ] || [ "$(stat -c %u "${DATA_DIR}")" != "1001" ]; then
        sudo install -d -m 750 -o 1001 -g 1001 "${DATA_DIR}"
    fi
    echo -e "${GREEN}Data directory OK${NC}"
}

build_image() {
    local TAR_FILE="${APP}.tar"
    echo -e "\n${YELLOW}Building Docker image...${NC}"
    docker build --no-cache -t ${IMAGE_NAME} .

    echo -e "${YELLOW}Importing image to MicroK8s...${NC}"
    docker save ${IMAGE_NAME} > ${TAR_FILE}
    microk8s ctr images rm docker.io/library/${IMAGE_NAME} 2>/dev/null || true
    microk8s ctr image import ${TAR_FILE}
    rm ${TAR_FILE}
    echo -e "${GREEN}Docker image built and imported${NC}"
}

apply_manifests() {
    echo -e "\n${YELLOW}Applying Kubernetes manifests...${NC}"
    $KUBECTL apply -f k8s/namespace.yaml
    $KUBECTL apply -f k8s/configmap.yaml
    $KUBECTL apply -f k8s/deployment.yaml
    $KUBECTL apply -f k8s/service.yaml
    $KUBECTL apply -f k8s/ingress.yaml
    echo -e "${GREEN}Manifests applied${NC}"
}

wait_for_deployment() {
    echo -e "\n${YELLOW}Restarting pod to pick up the new image...${NC}"
    # the tag 'latest' does not change, so Kubernetes would not restart on its own
    $KUBECTL rollout restart deployment/${APP} -n ${APP}
    $KUBECTL rollout status deployment/${APP} -n ${APP} --timeout=120s
    echo -e "${GREEN}Deployment ready${NC}"
}

show_access_info() {
    echo -e "\n${GREEN}Deployment completed!${NC}"
    echo -e "  URL:   https://${HOSTNAME}"
    echo -e "  Data:  ${DATA_DIR}"
    echo -e "\n${YELLOW}Useful commands:${NC}"
    echo -e "  $KUBECTL get pods -n ${APP}"
    echo -e "  $KUBECTL logs -f deployment/${APP} -n ${APP}"
    echo -e "  $KUBECTL get certificate -n ${APP}"
}

main() {
    case "${1:-deploy}" in
        build)
            check_prerequisites
            build_image
            ;;
        apply)
            check_prerequisites
            prepare_data_dir
            apply_manifests
            wait_for_deployment
            show_access_info
            ;;
        deploy)
            check_prerequisites
            prepare_data_dir
            build_image
            apply_manifests
            wait_for_deployment
            show_access_info
            ;;
        status)
            $KUBECTL get all,ingress,certificate -n ${APP}
            ;;
        logs)
            $KUBECTL logs -f deployment/${APP} -n ${APP}
            ;;
        delete)
            echo -e "${YELLOW}Deleting deployment (data in ${DATA_DIR} is kept)...${NC}"
            $KUBECTL delete namespace ${APP} --ignore-not-found
            echo -e "${GREEN}Deployment deleted${NC}"
            ;;
        *)
            echo "Usage: $0 {build|apply|deploy|status|logs|delete}"
            echo ""
            echo "  build   - Build the Docker image and import it into MicroK8s"
            echo "  apply   - Apply the K8s manifests and restart the pod"
            echo "  deploy  - Full deployment (build + apply), default"
            echo "  status  - Show pods, service, ingress and certificate"
            echo "  logs    - Follow the application logs"
            echo "  delete  - Delete the namespace (keeps the SQLite data on the host)"
            exit 1
            ;;
    esac
}

main "$@"
