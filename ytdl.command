#!/bin/bash
# ytdl.command - 맥에서 더블클릭해 쓰는 런처
#
# 사용법: 이 파일을 더블클릭하면 터미널이 열립니다.
#         YouTube 링크를 붙여넣고 엔터를 누르면 받아집니다.
#         여러 개는 띄어쓰기로 구분해 한 번에 붙여넣어도 됩니다.
#         그냥 엔터를 누르면 종료됩니다.

set -u

# ── 스크립트 자신의 실제 위치 찾기 (별칭/심볼릭 링크 대응) ──
SRC="${BASH_SOURCE[0]}"
while [ -L "$SRC" ]; do
  TARGET="$(readlink "$SRC")"
  case "$TARGET" in
    /*) SRC="$TARGET" ;;
    *)  SRC="$(dirname "$SRC")/$TARGET" ;;
  esac
done
DIR="$(cd "$(dirname "$SRC")" && pwd)"

# ytdl.py 가 옆에 없으면 흔한 설치 위치를 찾아본다
if [ ! -f "$DIR/ytdl.py" ]; then
  for CAND in "$HOME/Downloads/TOKEN" "$HOME/TOKEN" "$HOME/Documents/TOKEN"; do
    if [ -f "$CAND/ytdl.py" ]; then DIR="$CAND"; break; fi
  done
fi

cd "$DIR" 2>/dev/null || true

if [ ! -f ytdl.py ]; then
  echo "ytdl.py 를 찾지 못했습니다."
  echo ""
  echo "이 파일은 TOKEN 폴더 안에 있어야 합니다."
  echo "바탕화면에 두고 싶으면 파일을 복사하지 말고,"
  echo "우클릭 > '별칭 만들기' 로 만든 별칭을 바탕화면에 두세요."
  echo ""
  printf '엔터를 누르면 닫힙니다. '
  read -r _
  exit 1
fi

# ── 파이썬 준비 ──
if [ -f .venv/bin/activate ]; then
  # shellcheck disable=SC1091
  . .venv/bin/activate
  PY=python
else
  PY="$(command -v python3.13 || command -v python3 || true)"
  if [ -z "$PY" ]; then
    echo "파이썬을 찾을 수 없습니다."
    echo "  brew install python@3.13"
    echo "설치 후 다시 시도하세요."
    printf '엔터를 누르면 닫힙니다. '
    read -r _
    exit 1
  fi
  echo "[안내] 가상환경(.venv)이 없어 시스템 파이썬으로 실행합니다."
fi

OUT="$DIR/downloads"

# ── 설치된 브라우저 순서대로 쿠키 시도 ──
BROWSERS=()
[ -d "/Applications/Google Chrome.app" ]   && BROWSERS+=(chrome)
[ -d "/Applications/Firefox.app" ]         && BROWSERS+=(firefox)
[ -d "/Applications/Brave Browser.app" ]   && BROWSERS+=(brave)
[ -d "/Applications/Microsoft Edge.app" ]  && BROWSERS+=(edge)
BROWSERS+=(safari)

DONE=0

download() {
  url="$1"
  url="${url%%&*}"       # 공유 추적 파라미터 제거
  url="${url%%\?si=*}"
  [ -z "$url" ] && return 0

  case "$url" in
    http://*|https://*) ;;
    *) echo "[건너뜀] 링크 형식이 아닙니다: $url"; return 1 ;;
  esac

  echo ""
  echo "────────────────────────────────────────"
  echo "▶ $url"
  echo "────────────────────────────────────────"

  for b in "${BROWSERS[@]}"; do
    if "$PY" ytdl.py "$url" -o "$OUT" --cookies-from-browser "$b"; then
      DONE=$((DONE + 1))
      return 0
    fi
    echo "[재시도] $b 쿠키 실패 → 다음 브라우저"
  done

  echo "[실패] $url"
  echo "        브라우저에 YouTube 로그인이 되어 있는지 확인하세요."
  return 1
}

clear
echo "╭──────────────────────────────────────╮"
echo "│   YouTube 다운로더                   │"
echo "╰──────────────────────────────────────╯"
echo ""
echo "저장 위치 : $OUT"
echo "쿠키 순서 : ${BROWSERS[*]}"

# 드래그 앤 드롭이나 인자로 넘어온 링크 처리
if [ "$#" -gt 0 ]; then
  for u in "$@"; do download "$u" || true; done
fi

while true; do
  echo ""
  printf '링크 붙여넣고 엔터 (그냥 엔터 = 종료) > '
  if ! read -r line; then break; fi
  case "$line" in
    *[!\ ]*) ;;   # 공백 아닌 문자가 있으면 진행
    *) break ;;
  esac
  for u in $line; do download "$u" || true; done
done

echo ""
if [ "$DONE" -gt 0 ]; then
  echo "완료: $DONE 개 저장됨 → $OUT"
  open "$OUT" 2>/dev/null || true
else
  echo "받은 파일이 없습니다."
fi
