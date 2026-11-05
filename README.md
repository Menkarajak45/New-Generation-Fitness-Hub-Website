# New Generation Fitness Hub – Public Website

A responsive black-and-gold website for **New Generation Fitness Hub – Unisex Gym**, Ghatkopar West, Mumbai.

## Features
- Home, About, Facilities, Membership Plans, Gallery and Contact pages.
- Responsive design with gym video.
- Membership enquiry form with WhatsApp integration.
- Private owner login to manage membership plans.
- Poster-based membership pricing.
- Mobile-friendly layout.

## Tech Stack
- Frontend: React, Vite, CSS
- Backend: Node.js, Express.js
- Database: MongoDB Atlas

## Installation

```bash
npm install
```

Configure `server/.env` using `server/.env.example` and add MongoDB connection details and a secure JWT secret.

Create the owner account:

```bash
npm run seed:admin
```

## Run Locally

```bash
npm run dev
```

## Production

```bash
npm run build
npm start
```

## Deployment
Deploy as a Render Web Service.

- Build Command: `npm install && npm run build`
- Start Command: `npm start`

Configure the required environment variables in Render.

## Contact
**New Generation Fitness Hub – Unisex Gym**  
Ghatkopar West, Mumbai, Maharashtra  
Phone / WhatsApp: +91 72080 56577  
Instagram: [@new_generation_fitnesshub](https://www.instagram.com/new_generation_fitnesshub/)

*Note: Online payments are not enabled yet. Verify membership prices and gym timings before publishing.*
