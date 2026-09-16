# TOKEN
KAIA TOKEN

---

# ytdl - 개인용 YouTube 영상 다운로더

YouTube 링크 하나로 영상(mp4) 또는 음성(mp3)을 받는 간단한 커맨드라인 도구입니다.
[yt-dlp](https://github.com/yt-dlp/yt-dlp) 를 감싼 얇은 래퍼로, 본인이 볼 권한이 있는 영상의 개인 소장 용도로만 사용하세요.

## 설치

```bash
# Python 3.10 이상
pip install -r requirements.txt
```

- **ffmpeg**: 최고 화질(영상+음성 분리 스트림 병합)과 mp3 변환에 필요합니다.
  PATH 에 ffmpeg 가 없으면 `imageio-ffmpeg` 가 번들한 바이너리를 자동으로 사용하므로 별도 설치 없이도 동작합니다.
- **Node.js 또는 Deno**: YouTube 의 JS 챌린지를 풀기 위해 필요합니다. 설치되어 있으면 자동 인식되고,
  없으면 일부 화질이 누락될 수 있습니다. ([참고](https://github.com/yt-dlp/yt-dlp/wiki/EJS))

## 사용법

```bash
# 최고 화질 mp4 → ./downloads/
python ytdl.py https://youtu.be/9APZeLCZS3s

# 720p 이하로 제한
python ytdl.py https://youtu.be/9APZeLCZS3s -q 720

# 음성만 mp3 로
python ytdl.py https://youtu.be/9APZeLCZS3s --audio

# 저장 폴더 지정
python ytdl.py https://youtu.be/9APZeLCZS3s -o ~/Videos
```

| 옵션 | 설명 |
| --- | --- |
| `-o, --output DIR` | 저장 폴더 (기본 `./downloads`) |
| `-q, --quality` | `best`, `2160`, `1440`, `1080`, `720`, `480`, `360` 중 최대 세로 해상도 |
| `-a, --audio` | 음성만 mp3(192kbps) 로 저장 |
| `--cookies FILE` | Netscape 형식 쿠키 파일 사용 |
| `--cookies-from-browser BROWSER` | 브라우저(chrome, edge, firefox, brave, safari …)에 로그인된 쿠키 사용 |
| `--quiet` | 진행 출력 최소화 |

## "Sign in to confirm you're not a bot" 오류가 날 때

YouTube 는 클라우드/데이터센터 IP 나 짧은 시간에 요청이 많은 IP 에 로그인 확인을 요구합니다.
브라우저에서 YouTube 에 로그인된 상태로 아래처럼 실행하면 해결됩니다.

```bash
python ytdl.py "https://youtu.be/9APZeLCZS3s" --cookies-from-browser chrome
```

크롬이 실행 중이면 쿠키 DB 가 잠겨 읽기에 실패할 수 있으니, 그 경우 브라우저를 닫고 다시 시도하거나
[쿠키 내보내기 확장](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies) 으로 `cookies.txt` 를 만들어 `--cookies cookies.txt` 로 넘기세요.

## 파일 구조

```
ytdl.py            다운로더 본체 (CLI + download() 함수)
requirements.txt   의존성
downloads/         기본 저장 폴더 (git 에서 제외)
```
