from typing import Callable, Awaitable

from starlette.types import ASGIApp, Receive, Scope, Send

from app.metrics import http_metrics_start, http_metrics_end


class MetricsMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "GET")
        path = scope.get("path", "/")
        started = http_metrics_start()
        done = False
        status_holder = {"status": 200}

        async def send_wrapper(message):
            nonlocal done
            if message["type"] == "http.response.start":
                status_holder["status"] = int(message.get("status", 200))
            if message["type"] == "http.response.body" and not message.get("more_body", False):
                if not done:
                    http_metrics_end(method, path, status_holder["status"], started)
                    done = True
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            if not done:
                http_metrics_end(method, path, 500, started)
                done = True
            raise

