#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
service="${1:-all}"
log_dir="${PRACTICE_LOG_ROOT:-/data_new/moyancheng/experiments/imed-lung-teacher-viewer}/services_$(date +%Y%m%d_%H%M%S)_$$"
mkdir -p "$log_dir"
if [[ "$service" == sam || "$service" == all ]]; then
  if screen -S imed-lung-sam-8766 -Q select . >/dev/null 2>&1; then
    echo 'SAM screen 已运行。'
  else
    screen -dmS imed-lung-sam-8766 -L -Logfile "$log_dir/sam.log" \
      "${SAM_PYTHON:-/data_new/moyancheng/envs/imed-lung-sam-api/bin/python}" -u "$project_root/sam_api.py" \
      --sam-source "${SAM_SOURCE:-/data_new/moyancheng/code/agent/SAM/segment-anything}" \
      --checkpoint "${SAM_CHECKPOINT:-/data_new/moyancheng/code/agent/SAM/segment-anything/web_ui/checkpoints/lung_sam2_hiera_l.pt}" \
      --device "${SAM_DEVICE:-cuda:0}" --port 8766
  fi
fi
if [[ "$service" == viewer || "$service" == all ]]; then
  if screen -S imed-lung-viewer-8765 -Q select . >/dev/null 2>&1; then
    echo '阅片服务 screen 已运行。'
  else
    screen -dmS imed-lung-viewer-8765 -L -Logfile "$log_dir/viewer.log" \
      "${VIEWER_PYTHON:-/data_new/moyancheng/envs/imed-lung-teacher-viewer/bin/python}" -u remote_server.py \
      --user-data-root "${USER_DATA_ROOT:-/data_new/moyancheng/experiments/imed-lung-teacher-viewer/account_data}" \
      --data-root "${DATA_ROOT:-/data5/zhangzhixuan/Med3DVLM/data}" --port 8765 \
      --sam-api-url http://127.0.0.1:8766 \
      --practice-output-root "${PRACTICE_OUTPUT_ROOT:-/data_new/moyancheng/experiments/imed-lung-teacher-viewer/practice_records}"
  fi
fi
printf '本次日志目录：%s\n' "$log_dir"
