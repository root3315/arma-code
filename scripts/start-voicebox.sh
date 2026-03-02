#!/bin/bash
# =============================================================================
# Voicebox Backend Startup Script
# Optimized for 16-core Xeon Gold on Ubuntu 24.04 LTS
# =============================================================================

set -e  # Exit on error

# Configuration
VOICEBOX_DIR="${HOME}/arma-code-workspace/voicebox-local"
PORT="${VOICEBOX_PORT:-8001}"
HOST="${VOICEBOX_HOST:-0.0.0.0}"
MODEL_SIZE="${VOICEBOX_MODEL_SIZE:-1.7B}"

# CPU Optimization for Xeon Gold 16-core
export OMP_NUM_THREADS=16
export MKL_NUM_THREADS=16
export KMP_AFFINITY="granularity=fine,compact,1,0"
export KMP_BLOCKTIME=0

# PyTorch optimization
export PYTORCH_NO_CUDA_MEMORY_CACHING=1  # Save memory on CPU-only systems

# Logging
LOG_FILE="${HOME}/arma-code-workspace/logs/voicebox_$(date +%Y%m%d_%H%M%S).log"
mkdir -p "$(dirname "$LOG_FILE")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# Functions
# =============================================================================

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

check_requirements() {
    log_info "Checking requirements..."
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is not installed"
        exit 1
    fi
    
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    log_debug "Python version: $PYTHON_VERSION"
    
    # Check if voicebox directory exists
    if [ ! -d "$VOICEBOX_DIR" ]; then
        log_error "Voicebox directory not found: $VOICEBOX_DIR"
        log_info "Clone Voicebox repository first:"
        echo "  git clone https://github.com/jamiepine/voicebox.git $VOICEBOX_DIR"
        exit 1
    fi
    
    # Check if dependencies are installed
    if ! python3 -c "import torch" 2>/dev/null; then
        log_warn "PyTorch not found. Installing dependencies..."
        cd "$VOICEBOX_DIR"
        pip install -r requirements.txt
    fi
    
    log_info "All requirements satisfied"
}

check_port() {
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        log_warn "Port $PORT is already in use"
        log_info "Killing existing process..."
        kill $(lsof -t -i:$PORT) 2>/dev/null || true
        sleep 2
    fi
}

show_status() {
    log_info "Voicebox Backend Configuration:"
    echo "  Directory:    $VOICEBOX_DIR"
    echo "  Host:         $HOST"
    echo "  Port:         $PORT"
    echo "  Model Size:   $MODEL_SIZE"
    echo "  CPU Threads:  $OMP_NUM_THREADS"
    echo "  Log File:     $LOG_FILE"
    echo ""
}

start_server() {
    log_info "Starting Voicebox backend server..."
    log_debug "Logging to: $LOG_FILE"
    
    cd "$VOICEBOX_DIR"
    
    # Start server with logging
    python3 -m uvicorn backend.server:app \
        --host "$HOST" \
        --port "$PORT" \
        --log-level info \
        2>&1 | tee -a "$LOG_FILE" &
    
    SERVER_PID=$!
    echo $SERVER_PID > "${VOICEBOX_DIR}/voicebox.pid"
    
    log_info "Server started with PID: $SERVER_PID"
    
    # Wait for server to be ready
    log_info "Waiting for server to be ready..."
    for i in {1..30}; do
        if curl -s "http://localhost:$PORT/health" > /dev/null 2>&1; then
            log_info "Server is ready!"
            show_health
            return 0
        fi
        sleep 1
    done
    
    log_error "Server failed to start within 30 seconds"
    return 1
}

show_health() {
    log_info "Health check:"
    curl -s "http://localhost:$PORT/health" | python3 -m json.tool 2>/dev/null || \
        curl -s "http://localhost:$PORT/health"
    echo ""
}

stop_server() {
    log_info "Stopping Voicebox backend..."
    
    if [ -f "${VOICEBOX_DIR}/voicebox.pid" ]; then
        PID=$(cat "${VOICEBOX_DIR}/voicebox.pid")
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            log_info "Server stopped (PID: $PID)"
            rm -f "${VOICEBOX_DIR}/voicebox.pid"
        else
            log_warn "Server not running (stale PID file)"
            rm -f "${VOICEBOX_DIR}/voicebox.pid"
        fi
    else
        # Try to find by process name
        pkill -f "uvicorn backend.server:app" 2>/dev/null && \
            log_info "Server stopped" || \
            log_warn "No running server found"
    fi
}

restart_server() {
    stop_server
    sleep 2
    start_server
}

# =============================================================================
# Main
# =============================================================================

usage() {
    echo "Usage: $0 {start|stop|restart|status|health}"
    echo ""
    echo "Commands:"
    echo "  start   - Start Voicebox backend server"
    echo "  stop    - Stop Voicebox backend server"
    echo "  restart - Restart Voicebox backend server"
    echo "  status  - Show server status"
    echo "  health  - Show health check"
    echo ""
    echo "Environment Variables:"
    echo "  VOICEBOX_PORT       - Server port (default: 8001)"
    echo "  VOICEBOX_HOST       - Server host (default: 0.0.0.0)"
    echo "  VOICEBOX_MODEL_SIZE - Model size: 1.7B or 0.6B (default: 1.7B)"
    echo ""
}

case "${1:-start}" in
    start)
        check_requirements
        check_port
        show_status
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        if [ -f "${VOICEBOX_DIR}/voicebox.pid" ]; then
            PID=$(cat "${VOICEBOX_DIR}/voicebox.pid")
            if kill -0 $PID 2>/dev/null; then
                log_info "Server is running (PID: $PID)"
                show_health
            else
                log_warn "Server not running (stale PID file)"
            fi
        else
            if pgrep -f "uvicorn backend.server:app" > /dev/null; then
                log_info "Server is running"
                pgrep -f "uvicorn backend.server:app"
            else
                log_warn "Server is not running"
            fi
        fi
        ;;
    health)
        curl -s "http://localhost:$PORT/health" | python3 -m json.tool
        ;;
    *)
        usage
        exit 1
        ;;
esac

exit 0
