"""
LearnPulse AI - Backend Authentication Middleware
"""

from database.db_helper import authenticate_user, register_user

class AuthMiddleware:
    @staticmethod
    def login(email: str, password: str, role: str):
        return authenticate_user(email, password, role)

    @staticmethod
    def signup(name: str, email: str, password: str, role: str, extra_info: str = ""):
        return register_user(name, email, password, role, extra_info)
