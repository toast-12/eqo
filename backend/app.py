from flask import Flask, jsonify, request
from flask_cors import CORS

# Flask 앱 생성
app = Flask(__name__)
# CORS 설정 (모든 도메인에서 오는 요청을 허용)
CORS(app)

@app.route('/')
def home():
    return "Welcome to the Backend!"

# 이 파일이 직접 실행될 때만 Flask 개발 서버를 실행
if __name__ == '__main__':
    # 0.0.0.0: 모든 IP에서 접근 가능하도록 설정
    # port=5001: Next.js 개발 서버(보통 3000)와의 충돌을 피하기 위해 다른 포트 사용
    app.run(host='0.0.0.0', port=5001, debug=True)