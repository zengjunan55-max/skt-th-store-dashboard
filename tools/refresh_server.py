import json
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from build_dashboard_data import run_refresh


HOST = "127.0.0.1"
PORT = 8765
SITE_ROOT = Path(__file__).resolve().parent


class RefreshHandler(BaseHTTPRequestHandler):
    def _send_json(self, status_code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send_json(200, {"ok": True})

    def do_GET(self):
        route = urlparse(self.path).path
        if route == "/health":
            self._send_json(
                200,
                {
                    "ok": True,
                    "service": "dashboard-refresh",
                    "time": datetime.now().isoformat(timespec="seconds"),
                    "siteRoot": str(SITE_ROOT),
                },
            )
            return
        self._send_json(404, {"ok": False, "error": "not_found"})

    def do_POST(self):
        route = urlparse(self.path).path
        if route != "/refresh":
            self._send_json(404, {"ok": False, "error": "not_found"})
            return
        try:
            result = run_refresh()
            result["ok"] = True
            result["refreshedAt"] = datetime.now().isoformat(timespec="minutes")
            self._send_json(200, result)
        except Exception as error:
            self._send_json(
                500,
                {
                    "ok": False,
                    "error": str(error),
                    "time": datetime.now().isoformat(timespec="seconds"),
                },
            )

    def log_message(self, format, *args):
        return


def main():
    server = ThreadingHTTPServer((HOST, PORT), RefreshHandler)
    print(f"refresh server listening on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
