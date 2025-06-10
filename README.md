# Simple Shopping Demo

This repository contains a minimal Node.js shopping site implementation using
only built-in modules. It demonstrates basic features:

* User registration and login
* Shopping cart and checkout with point accumulation
* Product search
* Basic admin interface for product and setting management
* Placeholder for 7‑11 logistics integration (credentials configurable via environment)

## Usage

Run the server:

```bash
node server.js
```

The server listens on port `3000` by default. Environment variables can be used
to override logistics credentials:

```
LOGISTIC_STORE_ID=3290635
LOGISTIC_KEY1=KWWEptKS89EVX2xS
LOGISTIC_KEY2=rQw5T7utTGUQXqRK
```
The above values are demo placeholders and should be replaced with your own credentials.

Endpoints are JSON based:

* `POST /register` – `username` and `password` (form data)
* `POST /login` – `username` and `password` (form data)
* `GET /products?q=term` – search products
* `POST /cart` – add item `{productId, qty}` (JSON)
* `GET /cart` – view cart
* `POST /checkout` – finalize order
* `GET|POST|PUT|DELETE /admin/products` – admin product management
* `GET|POST|PUT /admin/settings` – manage store info (name, logo, banner)
* `GET /admin/report` – view sales orders and totals
* `GET /settings` – public store information

This is a simplified example and not intended for production use.
