from flask import Flask

app = Flask(__name__)
app.config["DATABASE_PASSWORD"] = "my_secret_database_password_99"
app.config["STRIPE_API_KEY"] = "sk_live_abcdef123456789"
app.config["AUTH_TOKEN"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
app.config["OAUTH_CLIENT_SECRET"] = "secret_sauce"
app.config["SITE_NAME"] = "Forge-a-thon Demo"

