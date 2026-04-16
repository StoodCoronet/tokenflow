#!/bin/bash
# Token Flow 一键启动脚本

set -e

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Token Flow...${NC}"

# 检查 Conda
if ! command -v conda &> /dev/null; then
    echo "❌ Conda not found. Please install Anaconda or Miniconda."
    exit 1
fi

# 启动后端
echo -e "${BLUE}📦 Starting Backend...${NC}"
cd backend

if ! conda env list | grep -q "tokenflow"; then
    echo "Creating conda environment..."
    conda create -n tokenflow python=3.11 -y
fi

source $(conda info --base)/etc/profile.d/conda.sh
conda activate tokenflow

pip install -q -r requirements.txt

# 启动后端 (后台)
python run.py &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"

cd ..

# 启动前端
echo -e "${BLUE}🎨 Starting Frontend...${NC}"
cd frontend

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# 启动前端 (后台)
npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"

cd ..

echo ""
echo -e "${GREEN}🎉 Token Flow is running!${NC}"
echo ""
echo "📊 Dashboard: http://localhost:40002"
echo "📚 API Docs:  http://localhost:40001/docs"
echo ""
echo "Press Ctrl+C to stop"

# 等待中断
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
