import sys
import time
import requests

BASE_URL = "http://127.0.0.1:8000/api"

def run_tests():
    print("Starting API Authentication Flow Verification...")
    
    # 1. Registration Test
    register_url = f"{BASE_URL}/auth/register/"
    reg_data = {
        "username": f"tester_john_{int(time.time())}",
        "email": f"john_{int(time.time())}@test.com",
        "password": "TestPassword123",
        "experience_level": "Intermediate",
        "favorite_sectors": ["Technology", "Healthcare"]
    }
    
    print(f"Registering user: {reg_data['username']}")
    reg_resp = requests.post(register_url, json=reg_data)
    if reg_resp.status_code != 201:
        print(f"[ERROR] Registration failed: Status {reg_resp.status_code}, Response: {reg_resp.text}")
        sys.exit(1)
    
    reg_json = reg_resp.json()
    print("[OK] Registration works! Received tokens and user profile.")
    
    tokens = reg_json.get("tokens", {})
    access_token = tokens.get("access")
    refresh_token = tokens.get("refresh")
    
    if not access_token or not refresh_token:
        print("[ERROR] Tokens missing from registration payload.")
        sys.exit(1)

    # 2. Login Test
    login_url = f"{BASE_URL}/auth/login/"
    login_data = {
        "username": reg_data["username"],
        "password": reg_data["password"]
    }
    print("Testing Login view...")
    login_resp = requests.post(login_url, json=login_data)
    if login_resp.status_code != 200:
        print(f"[ERROR] Login failed: Status {login_resp.status_code}, Response: {login_resp.text}")
        sys.exit(1)
        
    login_json = login_resp.json()
    print("[OK] Login works! Received JWT access and refresh tokens.")
    
    access_token = login_json.get("access")
    refresh_token = login_json.get("refresh")
    
    # 3. Profile Fetch Test
    profile_url = f"{BASE_URL}/auth/profile/"
    headers = {"Authorization": f"Bearer {access_token}"}
    print("Fetching User Profile...")
    profile_resp = requests.get(profile_url, headers=headers)
    if profile_resp.status_code != 200:
        print(f"[ERROR] Fetch profile failed: Status {profile_resp.status_code}, Response: {profile_resp.text}")
        sys.exit(1)
        
    profile_json = profile_resp.json()
    print(f"[OK] Profile API (GET) works! Username: {profile_json['username']}")
    print(f"Current experience level: {profile_json['profile']['experience_level']}")
    
    # 4. Profile Update Test
    update_data = {
        "first_name": "John",
        "last_name": "Doe",
        "experience_level": "Advanced",
        "favorite_sectors": ["Technology", "Healthcare", "Energy"]
    }
    print("Updating User Profile...")
    update_resp = requests.put(profile_url, headers=headers, json=update_data)
    if update_resp.status_code != 200:
        print(f"[ERROR] Profile update failed: Status {update_resp.status_code}, Response: {update_resp.text}")
        sys.exit(1)
        
    updated_json = update_resp.json()
    print("[OK] Profile API (PUT) works!")
    print(f"Updated Name: {updated_json['first_name']} {updated_json['last_name']}")
    print(f"Updated experience level: {updated_json['profile']['experience_level']}")
    print(f"Updated sectors: {updated_json['profile']['favorite_sectors']}")
    
    # 5. Token Refresh Test
    refresh_url = f"{BASE_URL}/auth/token/refresh/"
    print("Refreshing Access Token...")
    refresh_resp = requests.post(refresh_url, json={"refresh": refresh_token})
    if refresh_resp.status_code != 200:
        print(f"[ERROR] Token refresh failed: Status {refresh_resp.status_code}, Response: {refresh_resp.text}")
        sys.exit(1)
        
    new_access_token = refresh_resp.json().get("access")
    print("[OK] JWT Refresh works! Acquired new access token.")
    
    # 6. Logout / Blacklist Test
    logout_url = f"{BASE_URL}/auth/logout/"
    print("Logging out (Blacklisting refresh token)...")
    logout_resp = requests.post(logout_url, headers={"Authorization": f"Bearer {new_access_token}"}, json={"refresh": refresh_token})
    if logout_resp.status_code != 200:
        print(f"[ERROR] Logout failed: Status {logout_resp.status_code}, Response: {logout_resp.text}")
        sys.exit(1)
        
    print("[OK] Logout works! Refresh token blacklisted successfully.")
    
    # Verify that the blacklisted refresh token can no longer be used to fetch new tokens
    print("Verifying refresh token is blacklisted...")
    retry_refresh_resp = requests.post(refresh_url, json={"refresh": refresh_token})
    if retry_refresh_resp.status_code == 200:
        print("[ERROR] Blacklisted refresh token was still valid!")
        sys.exit(1)
        
    print("[OK] Verification check succeeded! Blacklisted token blocked.")
    print("\n[SUCCESS] ALL AUTHENTICATION APIS VERIFIED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
