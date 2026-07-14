from django.utils.deprecation import MiddlewareMixin
from django.conf import settings


class ForceCORSHeadersMiddleware(MiddlewareMixin):
    """Fallback middleware to ensure CORS headers are present on responses.

    This runs as a safety net when the deployed environment strips or
    misconfigures header handling. It reads allowed origins from
    `CORS_ALLOWED_ORIGINS` or allows any origin when `CORS_ALLOW_ALL_ORIGINS`
    is True.
    """

    def process_response(self, request, response):
        origin = request.META.get('HTTP_ORIGIN')

        allow_all = getattr(settings, 'CORS_ALLOW_ALL_ORIGINS', False)
        allowed = getattr(settings, 'CORS_ALLOWED_ORIGINS', []) or []

        if origin:
            if allow_all or origin in allowed:
                response['Access-Control-Allow-Origin'] = origin
            else:
                # If origin not allowed, do not set header
                pass

        # Always allow credentials and common methods/headers for preflight
        response.setdefault('Access-Control-Allow-Credentials', 'true')
        response.setdefault('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
        response.setdefault('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-CSRFToken')
        response.setdefault('Access-Control-Max-Age', str(getattr(settings, 'CORS_PREFLIGHT_MAX_AGE', 600)))

        return response
