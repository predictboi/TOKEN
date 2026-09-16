#!/usr/bin/env python3
"""
ytdl.py - 개인용 YouTube 영상 다운로더

사용법:
    python ytdl.py <YouTube URL> [옵션]

예시:
    python ytdl.py https://youtu.be/9APZeLCZS3s
    python ytdl.py https://youtu.be/9APZeLCZS3s -q 720
    python ytdl.py https://youtu.be/9APZeLCZS3s --audio
    python ytdl.py https://youtu.be/9APZeLCZS3s -o ~/Videos
    python ytdl.py https://youtu.be/9APZeLCZS3s --cookies-from-browser chrome   # 봇 확인 우회

의존성: yt-dlp (필수), ffmpeg (영상+음성 병합 / mp3 변환 시 필요)
    pip install -r requirements.txt
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

try:
    import yt_dlp
except ImportError:  # pragma: no cover
    sys.exit("yt-dlp 가 설치되어 있지 않습니다. `pip install -r requirements.txt` 를 실행하세요.")


def find_ffmpeg() -> str | None:
    """PATH 에 있는 ffmpeg 를 우선 사용하고, 없으면 imageio-ffmpeg 번들 바이너리를 찾는다."""
    path = shutil.which("ffmpeg")
    if path:
        return path
    try:
        import imageio_ffmpeg  # type: ignore

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def find_js_runtimes() -> dict:
    """설치된 JS 런타임(deno/node/bun)을 자동 감지한다. YouTube 추출 시 일부 포맷에 필요."""
    runtimes: dict = {}
    for name in ("deno", "node", "bun"):
        path = shutil.which(name)
        if path:
            runtimes[name] = {"path": path}
    return runtimes


def build_format(quality: str, audio_only: bool, has_ffmpeg: bool) -> str:
    if audio_only:
        return "bestaudio/best"
    if not has_ffmpeg:
        # ffmpeg 가 없으면 영상+음성이 합쳐진 단일 파일만 받을 수 있다.
        return "best[ext=mp4]/best"
    if quality == "best":
        height_filter = ""
    else:
        height_filter = f"[height<={int(quality)}]"
    return (
        f"bestvideo{height_filter}[ext=mp4]+bestaudio[ext=m4a]"
        f"/bestvideo{height_filter}+bestaudio"
        f"/best{height_filter}/best"
    )


def download(url: str, out_dir: Path, quality: str = "best", audio_only: bool = False,
             quiet: bool = False, cookies_file: str | None = None,
             cookies_browser: str | None = None) -> Path | None:
    out_dir.mkdir(parents=True, exist_ok=True)
    ffmpeg = find_ffmpeg()
    if ffmpeg is None and not quiet:
        print("[경고] ffmpeg 를 찾을 수 없어 최고 화질 병합 및 mp3 변환이 제한됩니다.", file=sys.stderr)

    result: dict[str, Path | None] = {"path": None}

    def hook(d: dict) -> None:
        if d.get("status") == "finished":
            result["path"] = Path(d.get("filename", ""))

    opts: dict = {
        "format": build_format(quality, audio_only, ffmpeg is not None),
        "outtmpl": str(out_dir / "%(title)s [%(id)s].%(ext)s"),
        "noplaylist": True,
        "quiet": quiet,
        "no_warnings": quiet,
        "progress_hooks": [hook],
        "restrictfilenames": False,
        "windowsfilenames": True,
    }
    if cookies_file:
        opts["cookiefile"] = cookies_file
    if cookies_browser:
        # yt-dlp 형식: (browser, profile, keyring, container)
        opts["cookiesfrombrowser"] = (cookies_browser, None, None, None)

    js_runtimes = find_js_runtimes()
    if js_runtimes:
        opts["js_runtimes"] = js_runtimes
    elif not quiet:
        print("[경고] JS 런타임(node/deno)이 없어 일부 화질이 누락될 수 있습니다.", file=sys.stderr)
    if ffmpeg:
        opts["ffmpeg_location"] = ffmpeg
        if audio_only:
            opts["postprocessors"] = [
                {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}
            ]
        else:
            opts["merge_output_format"] = "mp4"

    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        final = Path(ydl.prepare_filename(info))
        if audio_only and ffmpeg:
            final = final.with_suffix(".mp3")
        elif ffmpeg and not audio_only:
            final = final.with_suffix(".mp4")
        if final.exists():
            return final
        return result["path"]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="개인용 YouTube 영상 다운로더")
    parser.add_argument("url", help="YouTube 영상 URL (youtu.be 단축 링크 지원)")
    parser.add_argument("-o", "--output", default="downloads", help="저장 폴더 (기본: ./downloads)")
    parser.add_argument("-q", "--quality", default="best",
                        choices=["best", "2160", "1440", "1080", "720", "480", "360"],
                        help="최대 세로 해상도 (기본: best)")
    parser.add_argument("-a", "--audio", action="store_true", help="음성만 mp3 로 저장")
    parser.add_argument("--cookies", metavar="FILE",
                        help="Netscape 형식 쿠키 파일 (YouTube 봇 확인 우회용)")
    parser.add_argument("--cookies-from-browser", metavar="BROWSER",
                        help="브라우저에서 쿠키를 직접 읽기 (chrome, edge, firefox, brave, safari 등)")
    parser.add_argument("--quiet", action="store_true", help="진행 출력 최소화")
    args = parser.parse_args(argv)

    try:
        path = download(args.url, Path(args.output), args.quality, args.audio, args.quiet,
                        cookies_file=args.cookies, cookies_browser=args.cookies_from_browser)
    except yt_dlp.utils.DownloadError as e:
        print(f"[실패] {e}", file=sys.stderr)
        if "Sign in to confirm" in str(e) or "not a bot" in str(e):
            print("\n[안내] YouTube 봇 확인에 걸렸습니다. 브라우저에 로그인된 상태에서 다음처럼 재시도하세요:\n"
                  f"    python ytdl.py \"{args.url}\" --cookies-from-browser chrome", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\n[중단] 사용자가 취소했습니다.", file=sys.stderr)
        return 130

    if path:
        print(f"\n[완료] {path}")
    else:
        print("\n[완료] 다운로드가 끝났습니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
